import json
from pathlib import Path
from typing import List, Dict, Optional
from app.core.config import PROJECTS_STORAGE, INITIAL_TOKENS
import requests

TOKENS_FILE = PROJECTS_STORAGE / "tokens.json"

class TokenManager:
    def __init__(self):
        self.tokens: List[Dict[str, any]] = []
        self.load_tokens()

    def load_tokens(self):
        if TOKENS_FILE.exists():
            try:
                with open(TOKENS_FILE, "r", encoding="utf-8") as f:
                    self.tokens = json.load(f)
            except Exception:
                self.tokens = []
        
        if not self.tokens:
            for t in INITIAL_TOKENS:
                self.tokens.append({
                    "key": t,
                    "active": True,
                    "remaining_chars": -1,
                    "last_error": None
                })
            self.save_tokens()

    def save_tokens(self):
        with open(TOKENS_FILE, "w", encoding="utf-8") as f:
            json.dump(self.tokens, f, indent=2, ensure_ascii=False)

    def get_tokens(self) -> List[Dict[str, any]]:
        return self.tokens

    def add_token(self, key: str) -> Dict[str, any]:
        key = key.strip()
        if not key:
            raise ValueError("Token key cannot be empty")
        for t in self.tokens:
            if t["key"] == key:
                t["active"] = True
                t["last_error"] = None
                self.save_tokens()
                return t
        
        new_token = {
            "key": key,
            "active": True,
            "remaining_chars": -1,
            "last_error": None
        }
        self.tokens.append(new_token)
        self.save_tokens()
        return new_token

    def remove_token(self, key: str):
        self.tokens = [t for t in self.tokens if t["key"] != key]
        self.save_tokens()

    def get_active_token(self) -> Optional[str]:
        for t in self.tokens:
            if t.get("active", True):
                return t["key"]
        return None

    def mark_token_exhausted(self, key: str, error_msg: str):
        for t in self.tokens:
            if t["key"] == key:
                t["active"] = False
                t["last_error"] = error_msg
        self.save_tokens()

    def check_token_quota(self, key: str) -> Dict[str, any]:
        url = "https://api.elevenlabs.io/v1/user/subscription"
        headers = {"xi-api-key": key}
        try:
            r = requests.get(url, headers=headers, timeout=10)
            if r.status_code == 200:
                data = r.json()
                total = data.get("character_limit", 0)
                used = data.get("character_count", 0)
                rem = max(0, total - used)
                for t in self.tokens:
                    if t["key"] == key:
                        t["remaining_chars"] = rem
                        t["active"] = rem > 0
                        t["last_error"] = None if rem > 0 else "Лимит символов исчерпан (0 remaining)"
                self.save_tokens()
                return {"success": True, "remaining": rem, "total": total, "used": used}
            else:
                for t in self.tokens:
                    if t["key"] == key:
                        t["active"] = False
                        t["last_error"] = f"API error ({r.status_code}): {r.text}"
                self.save_tokens()
                return {"success": False, "error": r.text}
        except Exception as e:
            return {"success": False, "error": str(e)}

token_manager = TokenManager()
