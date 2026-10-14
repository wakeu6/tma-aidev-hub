"""
Bulletproof Edge TTS synthesizer using official edge-tts Python library.
Supports rate adjustments, proxy fallback, and automatic clock skew correction.
"""
import sys
import argparse
import asyncio
import os
import edge_tts

async def synthesize(text, voice, rate, output_path, proxy=None):
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    # Попытка через прокси (для обхода региональных 403)
    proxies_to_try = [proxy] if proxy else ['http://127.0.0.1:10809', None]
    last_err = None
    for p in proxies_to_try:
        try:
            communicate = edge_tts.Communicate(text, voice, rate=rate, proxy=p)
            await communicate.save(output_path)
            if os.path.exists(output_path) and os.path.getsize(output_path) >= 500:
                return
        except Exception as e:
            last_err = e
    if last_err:
        raise last_err
    if not os.path.exists(output_path) or os.path.getsize(output_path) < 500:
        raise RuntimeError(f"Output file {output_path} is empty or missing")

def main():
    parser = argparse.ArgumentParser(description="Synthesize speech with edge-tts")
    parser.add_argument("--text", required=True, help="Text to speak")
    parser.add_argument("--voice", default="ru-RU-SvetlanaNeural", help="TTS voice name")
    parser.add_argument("--rate", default="+0%", help="Rate modifier, e.g. +6%")
    parser.add_argument("--output", required=True, help="Destination mp3 file")
    parser.add_argument("--proxy", default=None, help="HTTP/SOCKS proxy")
    args = parser.parse_args()

    try:
        asyncio.run(synthesize(args.text, args.voice, args.rate, args.output, args.proxy))
        print("TTS_SUCCESS")
        sys.exit(0)
    except Exception as e:
        print(f"TTS_ERROR: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
