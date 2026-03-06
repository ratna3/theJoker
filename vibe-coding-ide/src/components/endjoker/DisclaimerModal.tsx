/**
 * ENDj0K3R — Legal Disclaimer Modal
 * Must be accepted before using penetration testing features
 */

import React, { useState } from 'react';
import { ShieldAlert, X } from 'lucide-react';

interface DisclaimerModalProps {
    onAccept: () => void;
    onExit: () => void;
}

export const DisclaimerModal: React.FC<DisclaimerModalProps> = ({ onAccept, onExit }) => {
    const [check1, setCheck1] = useState(false);
    const [check2, setCheck2] = useState(false);
    const [check3, setCheck3] = useState(false);

    const allChecked = check1 && check2 && check3;

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
        }}>
            <div style={{
                maxWidth: '720px',
                width: '90%',
                maxHeight: '90vh',
                overflowY: 'auto',
                backgroundColor: '#1a0a0a',
                border: '2px solid #dc2626',
                borderRadius: '16px',
                padding: '32px',
                boxShadow: '0 0 60px rgba(220, 38, 38, 0.3)',
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    marginBottom: '24px',
                }}>
                    <ShieldAlert size={32} color="#ef4444" />
                    <h2 style={{
                        color: '#ef4444',
                        fontSize: '20px',
                        fontWeight: 700,
                        textAlign: 'center',
                        textTransform: 'uppercase',
                        letterSpacing: '2px',
                        margin: 0,
                    }}>
                        ⚠️ EXTREMELY IMPORTANT – READ CAREFULLY ⚠️
                    </h2>
                    <ShieldAlert size={32} color="#ef4444" />
                </div>

                {/* Warning text */}
                <div style={{
                    color: '#e5e5e5',
                    fontSize: '13px',
                    lineHeight: '1.7',
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    padding: '20px',
                    backgroundColor: '#0d0505',
                    border: '1px solid #7f1d1d',
                    borderRadius: '8px',
                    marginBottom: '24px',
                }}>
                    {`This software contains powerful cybersecurity research and testing capabilities.

ANY USE OF THIS FEATURE AGAINST ANY SYSTEM, NETWORK, DEVICE, ACCOUNT OR DATA 
THAT YOU DO NOT OWN AND DO NOT HAVE EXPLICIT WRITTEN PERMISSION 
TO TEST IS ILLEGAL in virtually every country (including — but not limited to — 
Computer Fraud and Abuse Act in USA, similar laws in EU/UK/India/etc.).

Examples of prohibited (and usually criminal) activities include:
• Unauthorized password cracking / brute-forcing
• Unauthorized scanning, probing or exploitation
• Man-in-the-middle / packet injection / spoofing on foreign networks
• Any form of unauthorized access, data exfiltration or denial-of-service
• Using this tool in any criminal, fraudulent, extortionate or harmful manner

By proceeding you confirm and agree to ALL of the following:

1. You will use this feature exclusively on systems / networks / accounts 
   that you personally own or for which you hold current, explicit, written 
   authorization from the owner / legal representative.

2. You understand that unauthorized use can result in severe criminal penalties, 
   including imprisonment.

3. The author(s), developer(s), distributor(s) and any related parties:
   • Provide this software AS IS with NO WARRANTIES whatsoever
   • EXPRESSLY DISCLAIM all liability for any damage, loss, legal consequences,
     prosecution, fines, imprisonment or any other harm arising from use (or 
     misuse) of this software
   • Will NOT be held responsible or liable in any way for your actions

4. You agree to indemnify and hold harmless the author(s) / developer(s) / 
   distributor(s) from any claim, demand, liability, cost or expense (including 
   legal fees) arising from your use or misuse of this software.

If you do NOT fully agree with every point above → CLOSE THIS PROGRAM IMMEDIATELY  
and DO NOT USE the controversial / high-risk features.

Continuing = you accept full personal criminal and civil responsibility.`}
                </div>

                {/* Checkboxes */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    marginBottom: '28px',
                }}>
                    <label style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        cursor: 'pointer',
                        color: check1 ? '#22c55e' : '#a3a3a3',
                        fontSize: '13px',
                        transition: 'color 0.2s',
                    }}>
                        <input
                            type="checkbox"
                            checked={check1}
                            onChange={(e) => setCheck1(e.target.checked)}
                            style={{ marginTop: '2px', accentColor: '#22c55e', cursor: 'pointer' }}
                        />
                        I have read and fully understand the above warning
                    </label>

                    <label style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        cursor: 'pointer',
                        color: check2 ? '#22c55e' : '#a3a3a3',
                        fontSize: '13px',
                        transition: 'color 0.2s',
                    }}>
                        <input
                            type="checkbox"
                            checked={check2}
                            onChange={(e) => setCheck2(e.target.checked)}
                            style={{ marginTop: '2px', accentColor: '#22c55e', cursor: 'pointer' }}
                        />
                        I confirm I will ONLY use this on authorized targets
                    </label>

                    <label style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        cursor: 'pointer',
                        color: check3 ? '#22c55e' : '#a3a3a3',
                        fontSize: '13px',
                        transition: 'color 0.2s',
                    }}>
                        <input
                            type="checkbox"
                            checked={check3}
                            onChange={(e) => setCheck3(e.target.checked)}
                            style={{ marginTop: '2px', accentColor: '#22c55e', cursor: 'pointer' }}
                        />
                        I accept all risk and release the author from any liability
                    </label>
                </div>

                {/* Buttons */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '16px',
                }}>
                    <button
                        onClick={onAccept}
                        disabled={!allChecked}
                        style={{
                            padding: '12px 32px',
                            borderRadius: '8px',
                            border: 'none',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: allChecked ? 'pointer' : 'not-allowed',
                            backgroundColor: allChecked ? '#22c55e' : '#374151',
                            color: allChecked ? '#000' : '#6b7280',
                            opacity: allChecked ? 1 : 0.6,
                            transition: 'all 0.2s',
                        }}
                    >
                        Proceed
                    </button>
                    <button
                        onClick={onExit}
                        style={{
                            padding: '12px 32px',
                            borderRadius: '8px',
                            border: '1px solid #dc2626',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            backgroundColor: 'transparent',
                            color: '#ef4444',
                            transition: 'all 0.2s',
                        }}
                    >
                        Exit
                    </button>
                </div>
            </div>
        </div>
    );
};
