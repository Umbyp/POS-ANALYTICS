"""Tiny bilingual-string helper shared by services that generate human-readable
text (insights, playbook, recommendations, assistant). Not a full i18n framework —
just picks between a Thai and an English string per request."""


def pick(lang: str, th: str, en: str) -> str:
    return en if lang == "en" else th
