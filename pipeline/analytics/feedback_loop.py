"""
Autonomous Feedback Loop & Dynamic Stop-List calibrator.
Syncs audience feedback into shared/stop_list.json and generates
prompt directives for the script generator before each pipeline run.
"""
import sys
import json
from pathlib import Path
from typing import List, Dict, Any

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
SHARED_DIR = ROOT_DIR / "shared"

class FeedbackLoop:
    def __init__(self):
        self.stop_list_file = SHARED_DIR / "stop_list.json"
        self.directive_file = SHARED_DIR / "producer_directive.json"
        self.report_file = SHARED_DIR / "analytics_report.json"

    def update_stop_list(self) -> List[str]:
        """
        Loads base stop-list, merges negative feedback signals from report,
        and saves into shared/stop_list.json.
        """
        # Baseline prohibited topics
        base_stop_list = [
            "gemini 1.5",
            "gemini 2.5",
            "claude 3.5",
            "gpt-4",
            "gpt-4o",
            "claude 3 sonnet",
            "курсы успешного успеха",
            "написание css руками",
        ]

        dynamic_additions = []
        if self.report_file.exists():
            try:
                with open(self.report_file, "r", encoding="utf-8") as f:
                    report = json.load(f)
                    for item in report.get("negative_signals", []):
                        comment = item.get("comment", "").lower()
                        if "старье" in comment or "устарело" in comment:
                            # Flag any obsolete keywords mentioned
                            if "1.5" in comment and "gemini 1.5" not in base_stop_list:
                                dynamic_additions.append("gemini 1.5")
            except Exception as e:
                print(f"[Feedback Loop] Error reading analytics report: {e}", file=sys.stderr)

        combined = sorted(list(set(base_stop_list + dynamic_additions)))
        
        with open(self.stop_list_file, "w", encoding="utf-8") as f:
            json.dump({
                "updated_at": "2026-10-14T01:00:00Z",
                "stop_topics": combined,
                "reason": "Автоматическая калибровка субагентом аналитики по комментариям зрителей",
            }, f, ensure_ascii=False, indent=2)

        print(f"[Feedback Loop] Updated stop_list.json with {len(combined)} active constraints.")
        return combined

    def generate_producer_directive(self) -> Dict[str, Any]:
        """
        Generates calibrated directives for the trend & script generator.
        """
        directive = {
            "target_year": 2026,
            "tone": "инженерный, уверенный, плотный, без воды и клише",
            "mandatory_flagships": [
                "Claude Sonnet 5.5 (гибридное рассуждение)",
                "GPT Astra 6 (SWE-bench рекордсмен)",
                "Gemini Flash 3.8 (5M токенов, нулевой пинг)",
                "Агентные CLI инструменты (Claude Code, Cursor)",
            ],
            "cta_strategy": {
                "placement": "Outro (финальные 4-5 секунд ролика)",
                "trigger": "Забирай исходники, готовый шаблон и бонусы в боте в закрепленном комментарии",
                "goal": "Перелив трафика в Telegram Mini App для фарминга поинтов",
            },
            "recommendation": "Максимальный фокус на реальный рабочий код, бенчмарки и прямую выгоду разработчика.",
        }

        with open(self.directive_file, "w", encoding="utf-8") as f:
            json.dump(directive, f, ensure_ascii=False, indent=2)

        print(f"[Feedback Loop] Generated producer_directive.json for script generator.")
        return directive

def run_feedback_loop():
    loop = FeedbackLoop()
    loop.update_stop_list()
    loop.generate_producer_directive()

if __name__ == "__main__":
    run_feedback_loop()
