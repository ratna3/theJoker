#!/usr/bin/env python3
"""
AirLLM Sidecar Server for The Joker Terminal
=============================================

A FastAPI server that wraps AirLLM to expose an OpenAI-compatible
/v1/chat/completions endpoint. This allows The Joker's existing
LMStudioClient to seamlessly use 70B-parameter models on 4GB RAM.

Citation:
  Li, G. (2023). AirLLM: scaling large language models on low-end
  commodity computers [Computer software].
  https://github.com/lyogavin/airllm/

Usage:
  python airllm_server.py --model garage-bAInd/Platypus2-70B-instruct
  python airllm_server.py --model meta-llama/Llama-2-70b-chat-hf --port 8899
  python airllm_server.py --model <hf-repo-id> --compression 4bit
"""

import argparse
import json
import os
import sys
import time
import uuid
from typing import List, Optional

try:
    from fastapi import FastAPI, HTTPException
    from fastapi.responses import JSONResponse
    import uvicorn
except ImportError:
    print("ERROR: FastAPI and uvicorn are required.")
    print("Install with: pip install fastapi uvicorn")
    sys.exit(1)

try:
    from airllm import AutoModel
except ImportError:
    print("ERROR: AirLLM is required.")
    print("Install with: pip install airllm")
    sys.exit(1)

# ============================================
# FastAPI App
# ============================================

app = FastAPI(
    title="AirLLM Sidecar — The Joker Terminal",
    description="OpenAI-compatible API powered by AirLLM for 70B models on 4GB RAM",
    version="1.0.0",
)

# Global state
model = None
model_name = None
max_length = 512
server_start_time = None


# ============================================
# Pydantic Models (inline to avoid dep)
# ============================================

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: str
    content: str
    name: Optional[str] = None


class ChatCompletionRequest(BaseModel):
    model: str = ""
    messages: List[ChatMessage]
    temperature: float = 0.7
    max_tokens: int = 256
    stream: bool = False


class ChatCompletionChoice(BaseModel):
    index: int = 0
    message: ChatMessage
    finish_reason: str = "stop"


class UsageInfo(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class ChatCompletionResponse(BaseModel):
    id: str = Field(default_factory=lambda: f"chatcmpl-{uuid.uuid4().hex[:12]}")
    object: str = "chat.completion"
    created: int = Field(default_factory=lambda: int(time.time()))
    model: str = ""
    choices: List[ChatCompletionChoice] = []
    usage: UsageInfo = Field(default_factory=UsageInfo)


class ModelObject(BaseModel):
    id: str
    object: str = "model"
    owned_by: str = "airllm"


class ModelListResponse(BaseModel):
    object: str = "list"
    data: List[ModelObject] = []


# ============================================
# Routes
# ============================================


@app.get("/")
async def root():
    """Health check root."""
    return {"status": "ok", "engine": "airllm", "model": model_name}


@app.get("/v1/models")
async def list_models():
    """List available models (OpenAI-compatible)."""
    if model_name is None:
        return ModelListResponse(data=[])
    return ModelListResponse(
        data=[ModelObject(id=model_name)]
    )


@app.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionRequest):
    """
    OpenAI-compatible chat completion endpoint.

    Converts chat messages into a single prompt, runs inference
    through AirLLM's layer-wise engine, and returns the response
    in the standard OpenAI format.
    """
    global model, model_name, max_length

    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet")

    if request.stream:
        raise HTTPException(
            status_code=400,
            detail="Streaming is not supported by AirLLM sidecar"
        )

    # Build a single prompt from chat messages
    prompt_parts = []
    for msg in request.messages:
        if msg.role == "system":
            prompt_parts.append(f"System: {msg.content}")
        elif msg.role == "user":
            prompt_parts.append(f"User: {msg.content}")
        elif msg.role == "assistant":
            prompt_parts.append(f"Assistant: {msg.content}")

    prompt_parts.append("Assistant:")
    input_text = "\n".join(prompt_parts)

    try:
        start_time = time.time()

        # Tokenize
        input_tokens = model.tokenizer(
            input_text,
            return_tensors="pt",
            return_attention_mask=False,
            truncation=True,
            max_length=max_length,
            padding=False,
        )

        # Generate
        generation_output = model.generate(
            input_tokens["input_ids"].cuda(),
            max_new_tokens=min(request.max_tokens, max_length),
            use_cache=True,
            return_dict_in_generate=True,
        )

        # Decode
        output_text = model.tokenizer.decode(generation_output.sequences[0])

        # Extract only the generated part (after the prompt)
        if "Assistant:" in output_text:
            parts = output_text.rsplit("Assistant:", 1)
            generated = parts[-1].strip() if len(parts) > 1 else output_text.strip()
        else:
            generated = output_text.strip()

        elapsed = time.time() - start_time

        # Build response
        prompt_token_count = len(input_tokens["input_ids"][0])
        completion_token_count = len(generation_output.sequences[0]) - prompt_token_count

        return ChatCompletionResponse(
            model=model_name or request.model,
            choices=[
                ChatCompletionChoice(
                    message=ChatMessage(role="assistant", content=generated),
                    finish_reason="stop",
                )
            ],
            usage=UsageInfo(
                prompt_tokens=prompt_token_count,
                completion_tokens=max(completion_token_count, 0),
                total_tokens=prompt_token_count + max(completion_token_count, 0),
            ),
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failed: {str(e)}")


# ============================================
# Startup
# ============================================


def load_model(model_id: str, compression: str = "none"):
    """Load the AirLLM model."""
    global model, model_name

    print(f"[AirLLM] Loading model: {model_id}")
    print(f"[AirLLM] Compression: {compression}")
    print(f"[AirLLM] This may take several minutes on first run (downloading + layer splitting)...")

    kwargs = {}
    if compression == "4bit":
        kwargs["compression"] = "4bit"
    elif compression == "8bit":
        kwargs["compression"] = "8bit"

    model = AutoModel.from_pretrained(model_id, **kwargs)
    model_name = model_id

    print(f"[AirLLM] Model loaded successfully: {model_id}")
    print(f"[AirLLM] Ready to serve requests.")


# ============================================
# CLI Entry Point
# ============================================


def main():
    global max_length, server_start_time

    parser = argparse.ArgumentParser(
        description="AirLLM Sidecar Server for The Joker Terminal"
    )
    parser.add_argument(
        "--model", "-m",
        type=str,
        default=os.environ.get("AIRLLM_MODEL", "garage-bAInd/Platypus2-70B-instruct"),
        help="HuggingFace model repo ID (default: garage-bAInd/Platypus2-70B-instruct)",
    )
    parser.add_argument(
        "--host",
        type=str,
        default="127.0.0.1",
        help="Host to bind to (default: 127.0.0.1)",
    )
    parser.add_argument(
        "--port", "-p",
        type=int,
        default=int(os.environ.get("AIRLLM_PORT", "8899")),
        help="Port to listen on (default: 8899)",
    )
    parser.add_argument(
        "--max-length",
        type=int,
        default=int(os.environ.get("AIRLLM_MAX_LENGTH", "512")),
        help="Maximum token length for input (default: 512)",
    )
    parser.add_argument(
        "--compression",
        type=str,
        choices=["none", "4bit", "8bit"],
        default=os.environ.get("AIRLLM_COMPRESSION", "none"),
        help="Quantization level (default: none — full precision)",
    )

    args = parser.parse_args()
    max_length = args.max_length

    # Load model before starting server
    load_model(args.model, args.compression)

    server_start_time = time.time()

    print(f"\n[AirLLM] Starting server at http://{args.host}:{args.port}")
    print(f"[AirLLM] OpenAI-compatible endpoint: http://{args.host}:{args.port}/v1/chat/completions")
    print(f"[AirLLM] Press Ctrl+C to stop\n")

    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
