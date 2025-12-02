/**
 * LLM Summarizer - Use LLM to enhance and summarize results
 * Phase 8: Data Processing & Output Formatting
 */

import { LMStudioClient } from './client';
import { FormattedItem } from '../cli/formatter';
import { logger } from '../utils/logger';
import { DataCleaner } from '../utils/cleaner';

/**
 * Summary result from LLM
 */
export interface SummarizedResult {
    originalItems: FormattedItem[];
    summary: string;
    keyInsights: string[];
    recommendations: string[];
    categories: Record<string, FormattedItem[]>;
    enhancedItems: EnhancedItem[];
    timestamp: Date;
}

/**
 * Enhanced item with LLM-generated metadata
 */
export interface EnhancedItem extends FormattedItem {
    relevanceScore?: number;
    sentiment?: 'positive' | 'neutral' | 'negative';
    keyPoints?: string[];
    category?: string;
}

/**
 * Options for summarization
 */
export interface SummarizeOptions {
    maxItems?: number;
    includeInsights?: boolean;
    includeRecommendations?: boolean;
    categorize?: boolean;
    enhanceItems?: boolean;
    context?: string;
    format?: 'brief' | 'detailed' | 'bullet-points';
}

/**
 * Default summarization options
 */
const DEFAULT_OPTIONS: SummarizeOptions = {
    maxItems: 50,
    includeInsights: true,
    includeRecommendations: true,
    categorize: true,
    enhanceItems: false, // Set to false by default as it's slower
    format: 'detailed',
};

/**
 * LLMSummarizer class - Use LLM to enhance and summarize results
 */
export class LLMSummarizer {
    private client: LMStudioClient;

    constructor(client?: LMStudioClient) {
        this.client = client || new LMStudioClient();
    }

    /**
     * Summarize an array of results using LLM
     * @param items - Items to summarize
     * @param query - Original query for context
     * @param options - Summarization options
     * @returns Summarized result
     */
    async summarizeResults(
        items: FormattedItem[],
        query: string,
        options: SummarizeOptions = {}
    ): Promise<SummarizedResult> {
        const opts = { ...DEFAULT_OPTIONS, ...options };
        const timestamp = new Date();

        // Limit items to prevent token overflow
        const limitedItems = items.slice(0, opts.maxItems);

        // Prepare items for LLM (clean and simplify)
        const preparedItems = this.prepareItemsForLLM(limitedItems);

        // Build the summarization prompt
        const prompt = this.buildSummarizationPrompt(preparedItems, query, opts);

        try {
            // Call LLM for summarization
            const response = await this.client.chat([
                {
                    role: 'system',
                    content: `You are a helpful assistant that analyzes and summarizes search results. 
                    Provide clear, actionable insights. Always respond in valid JSON format.`
                },
                {
                    role: 'user',
                    content: prompt
                }
            ]);

            // Parse LLM response
            const parsed = this.parseSummaryResponse(response.content);

            // Categorize items if requested
            const categories = opts.categorize
                ? this.categorizeItems(limitedItems, parsed.categories || {})
                : {};

            // Enhance items if requested
            const enhancedItems = opts.enhanceItems
                ? await this.enhanceItems(limitedItems, query)
                : limitedItems.map(item => ({ ...item } as EnhancedItem));

            return {
                originalItems: items,
                summary: parsed.summary || 'No summary available.',
                keyInsights: parsed.keyInsights || [],
                recommendations: parsed.recommendations || [],
                categories,
                enhancedItems,
                timestamp,
            };
        } catch (error) {
            logger.error('Failed to summarize results', { error });

            // Return a basic result on error
            return {
                originalItems: items,
                summary: `Found ${items.length} results for "${query}".`,
                keyInsights: [],
                recommendations: [],
                categories: {},
                enhancedItems: items.map(item => ({ ...item } as EnhancedItem)),
                timestamp,
            };
        }
    }

    /**
     * Generate a quick summary without full LLM analysis
     * @param items - Items to summarize
     * @param query - Original query
     * @returns Quick summary string
     */
    async quickSummary(items: FormattedItem[], query: string): Promise<string> {
        if (items.length === 0) {
            return `No results found for "${query}".`;
        }

        try {
            const topItems = items.slice(0, 5);
            const itemsText = topItems.map((item, i) =>
                `${i + 1}. ${item.title || item.description || 'Untitled'}`
            ).join('\n');

            const response = await this.client.chat([
                {
                    role: 'system',
                    content: 'Provide a brief 1-2 sentence summary of these search results. Be concise.'
                },
                {
                    role: 'user',
                    content: `Query: "${query}"\n\nTop Results:\n${itemsText}\n\nTotal results: ${items.length}`
                }
            ]);

            return DataCleaner.cleanForDisplay(response.content);
        } catch (error) {
            logger.debug('Quick summary failed, using fallback', { error });
            return `Found ${items.length} results for "${query}".`;
        }
    }

    /**
     * Extract key insights from items
     * @param items - Items to analyze
     * @returns Array of insights
     */
    async extractInsights(items: FormattedItem[]): Promise<string[]> {
        if (items.length === 0) return [];

        try {
            const itemsText = this.prepareItemsForLLM(items.slice(0, 20));

            const response = await this.client.chat([
                {
                    role: 'system',
                    content: 'Extract 3-5 key insights from these items. Return as JSON array of strings.'
                },
                {
                    role: 'user',
                    content: `Items:\n${itemsText}\n\nExtract key insights as a JSON array.`
                }
            ]);

            const cleaned = DataCleaner.cleanJson(response.content);
            if (cleaned) {
                const insights = JSON.parse(cleaned);
                if (Array.isArray(insights)) {
                    return insights.filter(i => typeof i === 'string');
                }
            }

            return [];
        } catch (error) {
            logger.debug('Failed to extract insights', { error });
            return [];
        }
    }

    /**
     * Generate recommendations based on items
     * @param items - Items to analyze
     * @param context - Additional context
     * @returns Array of recommendations
     */
    async generateRecommendations(items: FormattedItem[], context?: string): Promise<string[]> {
        if (items.length === 0) return [];

        try {
            const itemsText = this.prepareItemsForLLM(items.slice(0, 20));

            const response = await this.client.chat([
                {
                    role: 'system',
                    content: 'Based on these items, provide 3-5 actionable recommendations. Return as JSON array of strings.'
                },
                {
                    role: 'user',
                    content: `Items:\n${itemsText}\n${context ? `\nContext: ${context}` : ''}\n\nProvide recommendations as a JSON array.`
                }
            ]);

            const cleaned = DataCleaner.cleanJson(response.content);
            if (cleaned) {
                const recommendations = JSON.parse(cleaned);
                if (Array.isArray(recommendations)) {
                    return recommendations.filter(r => typeof r === 'string');
                }
            }

            return [];
        } catch (error) {
            logger.debug('Failed to generate recommendations', { error });
            return [];
        }
    }

    /**
     * Enhance items with LLM-generated metadata
     * @param items - Items to enhance
     * @param query - Original query for context
     * @returns Enhanced items
     */
    private async enhanceItems(items: FormattedItem[], query: string): Promise<EnhancedItem[]> {
        const enhanced: EnhancedItem[] = [];

        // Process in small batches to avoid overwhelming the LLM
        const batchSize = 5;
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map(item => this.enhanceItem(item, query))
            );
            enhanced.push(...batchResults);
        }

        return enhanced;
    }

    /**
     * Enhance a single item with LLM
     * @param item - Item to enhance
     * @param query - Query for context
     * @returns Enhanced item
     */
    private async enhanceItem(item: FormattedItem, query: string): Promise<EnhancedItem> {
        try {
            const itemText = JSON.stringify({
                title: item.title,
                description: item.description?.substring(0, 200),
                url: item.url,
            });

            const response = await this.client.chat([
                {
                    role: 'system',
                    content: `Analyze this item in context of the query "${query}". 
                    Return JSON with: relevanceScore (0-100), sentiment (positive/neutral/negative), 
                    keyPoints (array of 1-3 strings), category (single word).`
                },
                {
                    role: 'user',
                    content: itemText
                }
            ]);

            const cleaned = DataCleaner.cleanJson(response.content);
            if (cleaned) {
                const analysis = JSON.parse(cleaned);
                return {
                    ...item,
                    relevanceScore: analysis.relevanceScore,
                    sentiment: analysis.sentiment,
                    keyPoints: analysis.keyPoints,
                    category: analysis.category,
                };
            }
        } catch (error) {
            logger.debug('Failed to enhance item', { error, title: item.title });
        }

        return { ...item };
    }

    /**
     * Prepare items for LLM processing
     * @param items - Items to prepare
     * @returns Prepared text
     */
    private prepareItemsForLLM(items: FormattedItem[]): string {
        return items.map((item, index) => {
            const parts: string[] = [`${index + 1}.`];
            if (item.title) parts.push(`Title: ${DataCleaner.truncate(item.title, 100)}`);
            if (item.description) parts.push(`Desc: ${DataCleaner.truncate(item.description, 200)}`);
            if (item.url) parts.push(`URL: ${item.url}`);
            if (item.tags?.length) parts.push(`Tags: ${item.tags.join(', ')}`);
            return parts.join(' | ');
        }).join('\n');
    }

    /**
     * Build the summarization prompt
     * @param itemsText - Prepared items text
     * @param query - Original query
     * @param options - Summarization options
     * @returns Prompt string
     */
    private buildSummarizationPrompt(
        itemsText: string,
        query: string,
        options: SummarizeOptions
    ): string {
        const formatInstructions = {
            brief: 'Provide a brief 2-3 sentence summary.',
            detailed: 'Provide a comprehensive paragraph summary.',
            'bullet-points': 'Provide the summary as bullet points.',
        };

        let prompt = `Analyze these search results for the query "${query}":\n\n${itemsText}\n\n`;
        
        prompt += `Return a JSON object with the following structure:\n`;
        prompt += `{\n`;
        prompt += `  "summary": "string - ${formatInstructions[options.format || 'detailed']}",\n`;
        
        if (options.includeInsights) {
            prompt += `  "keyInsights": ["array of 3-5 key insights as strings"],\n`;
        }
        
        if (options.includeRecommendations) {
            prompt += `  "recommendations": ["array of 2-4 actionable recommendations"],\n`;
        }
        
        if (options.categorize) {
            prompt += `  "categories": {"category_name": ["indices of items in that category"]}\n`;
        }
        
        prompt += `}\n`;
        
        if (options.context) {
            prompt += `\nAdditional context: ${options.context}`;
        }

        return prompt;
    }

    /**
     * Parse the LLM summary response
     * @param content - LLM response content
     * @returns Parsed summary object
     */
    private parseSummaryResponse(content: string): {
        summary?: string;
        keyInsights?: string[];
        recommendations?: string[];
        categories?: Record<string, number[]>;
    } {
        try {
            const cleaned = DataCleaner.cleanJson(content);
            if (cleaned) {
                return JSON.parse(cleaned);
            }
        } catch (error) {
            logger.debug('Failed to parse summary response', { error });
        }

        // Fallback: try to extract summary from plain text
        const summary = DataCleaner.cleanForDisplay(content);
        return { summary };
    }

    /**
     * Categorize items based on LLM categories
     * @param items - Items to categorize
     * @param categoryIndices - Category to indices mapping
     * @returns Category to items mapping
     */
    private categorizeItems(
        items: FormattedItem[],
        categoryIndices: Record<string, number[]>
    ): Record<string, FormattedItem[]> {
        const categories: Record<string, FormattedItem[]> = {};

        for (const [category, indices] of Object.entries(categoryIndices)) {
            categories[category] = indices
                .filter(i => i >= 0 && i < items.length)
                .map(i => items[i]);
        }

        return categories;
    }
}

/**
 * Convenience function to summarize results
 * @param items - Items to summarize
 * @param query - Original query
 * @param options - Summarization options
 * @returns Summarized result
 */
export async function summarizeResults(
    items: FormattedItem[],
    query: string,
    options?: SummarizeOptions
): Promise<SummarizedResult> {
    const summarizer = new LLMSummarizer();
    return summarizer.summarizeResults(items, query, options);
}

/**
 * Convenience function for quick summary
 * @param items - Items to summarize
 * @param query - Original query
 * @returns Summary string
 */
export async function quickSummary(items: FormattedItem[], query: string): Promise<string> {
    const summarizer = new LLMSummarizer();
    return summarizer.quickSummary(items, query);
}

export default LLMSummarizer;
