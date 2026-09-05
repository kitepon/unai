# 貢献の仕方

unaiへの文章規範の提案には、対象の文章と文脈を添えてください。どの表現がなぜ不自然なのかを説明し、同じ表現が自然に働く例も示すと、直す範囲を判断しやすくなります。

可愛さ、感情、比喩、口癖、詳しい説明が失われた例は、誤修正として報告してください。個人の文体の好みは[声の設定](skills/unai/references/voice-profile.md)で扱い、共通規則にはしません。

文章規範を変えた場合は、[動作確認例](tests/prose-cases.md)の依頼を実際に実行し、出力を確認してください。期待する文言がファイルにあることを調べる自動testだけでは、校正の品質は確認できません。

挙動、installer、manifest、CIを変更した場合は、対応するfocused testを追加し、`node --test tests/unai.test.mjs tests/ci-contract.test.mjs`を通してください。文書のリンクは`npm run verify:docs`で確認します。

installerの不具合にはOSとホスト（Claude Code / Codex / Grok / Cursor）を添えてください。セキュリティに関わる報告は、[SECURITY.md](SECURITY.md)の非公開窓口を使ってください。
