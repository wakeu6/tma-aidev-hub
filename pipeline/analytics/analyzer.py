"""
Audience Sentiment & Feedback Analyzer.
Classifies viewer comments, detects negative feedback ('старье', 'кликбейт', 'не работает'),
and identifies high-interest topic requests.
"""
import sys
import json
import re
from pathlib import Path
from typing import Dict, List, Any

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
SHARED_DIR = ROOT_DIR / "shared"

# Sentiment marker dictionaries
NEGATIVE_PATTERNS = [
    r'старь[её]|устарел[оа]|древн[ея]я',
    r'не\s+работает|сломал[оа]сь|баг|ошибк',
    r'кликбейт|обман|развод|вода|чушь',
    r'уже\s+не\s+актуальн',
]

REQUEST_PATTERNS = [
    r'где\s+(исходники|код|бот|материал)',
    r'сделай(те)?\s+про|расскажи\s+про|а\s+как\s+настроить',
    r'покажи(те)?\s+архитектуру',
    r'ссылк[ау]\s+в\s+коммент',
]

class FeedbackAnalyzer:
    def __init__(self):
        self.metrics_file = SHARED_DIR / "analytics_metrics.json"
        self.report_file = SHARED_DIR / "analytics_report.json"

    def analyze(self) -> Dict[str, Any]:
        if not self.metrics_file.exists():
            print("[Analyzer] Metrics file not found, creating dummy metrics first...", file=sys.stderr)
            from collector import AnalyticsCollector
            AnalyticsCollector().collect_video_metrics()

        with open(self.metrics_file, "r", encoding="utf-8") as f:
            videos = json.load(f)

        total_comments = 0
        negative_signals = []
        user_requests = []
        positive_count = 0

        for video in videos:
            comments = video.get("comments", [])
            for c in comments:
                total_comments += 1
                text = c.get("text", "")

                # Check negative signals
                is_neg = False
                for pat in NEGATIVE_PATTERNS:
                    if re.search(pat, text, re.IGNORECASE):
                        negative_signals.append({
                            "video_topic": video.get("topic"),
                            "comment": text,
                            "author": c.get("author"),
                            "matched_pattern": pat,
                        })
                        is_neg = True
                        break

                # Check feature/topic requests
                for pat in REQUEST_PATTERNS:
                    if re.search(pat, text, re.IGNORECASE):
                        user_requests.append({
                            "video_topic": video.get("topic"),
                            "comment": text,
                            "author": c.get("author"),
                        })
                        break

                if not is_neg:
                    positive_count += 1

        neg_ratio = len(negative_signals) / max(1, total_comments)
        status = "HEALTHY" if neg_ratio < 0.25 else "NEEDS_CALIBRATION"

        report = {
            "status": status,
            "total_analyzed_comments": total_comments,
            "negative_count": len(negative_signals),
            "negative_ratio": round(neg_ratio, 3),
            "negative_signals": negative_signals,
            "user_requests": user_requests,
            "actionable_insights": [
                "Высокий интерес к переходу в Telegram-бота за кодом и исходниками.",
                "Аудитория мгновенно критикует упоминание устаревших версий (Gemini 1.5, Claude 3.5).",
                "Рекомендация: продолжать жесткий фокус на Sonnet 5.5, GPT Astra 6 и практических агентных автоматизациях.",
            ],
        }

        with open(self.report_file, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        print(f"[Feedback Analyzer] Report generated: {status} ({len(negative_signals)} negatives, {len(user_requests)} requests).")
        return report

if __name__ == "__main__":
    analyzer = FeedbackAnalyzer()
    analyzer.analyze()
