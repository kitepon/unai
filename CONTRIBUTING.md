# 貢献の仕方

AI特有の不自然な言葉遣いを、原文と修正例を添えて報告してください。

文章への指示の全文は[SKILL.md](skills/unai/SKILL.md)です。追加や修正の提案には、どの言葉遣いが不自然で、どう直すのかを示してください。利用案内を変更する場合は、[日本語README](README.md)と[英語README](README.en.md)の内容を揃えてください。

変更に対応するfocused testを実行し、`node --test tests/unai.test.mjs tests/ci-contract.test.mjs`と`npm run verify:docs`を通してください。

installerの不具合にはOSとホストを添えてください。セキュリティに関わる報告は[SECURITY.md](SECURITY.md)の非公開窓口を使ってください。

公開と導入後の確認は[RELEASE.md](RELEASE.md)に従います。
