# Third-party notices

Awesome Codex Themes is independently implemented. No source file, artwork, brand asset, binary, or theme package from the references below is distributed in this repository.

## Runtime architecture references

The following projects informed research into local-loopback CDP injection, lifecycle handling, and restoration boundaries:

| Project | Inspected commit | License at that commit | Use in this repository |
| --- | --- | --- | --- |
| [Fei-Away/Codex-Dream-Skin](https://github.com/Fei-Away/Codex-Dream-Skin) | `d985269db99d30fd39b42aaba392aeff670b5d3a` | MIT, “Codex Dream Skin Studio contributors” | Architecture research only; no source or assets incorporated. |
| [Cmochance/codex-app-transfer](https://github.com/Cmochance/codex-app-transfer) | `0b04a460c75aaaf212559f4c4d2734be2ec6e957` | MIT, “Codex App Transfer” | Architecture research only; no source or assets incorporated. |

Because no upstream source was copied or adapted, their copyright notices are not embedded in project source files. The exact commits are recorded for transparency and reproducibility.

## Gallery information-architecture research

The gallery uses general product patterns observed across open prompt libraries: image-first cards, free-text search, structured categories and tags, detail views, copy actions, and contribution through small data files. Research examples included:

- [f/prompts.chat](https://github.com/f/prompts.chat)
- [lobehub/lobe-chat-agents](https://github.com/lobehub/lobe-chat-agents)
- [EddieTYP/image-prompt-library](https://github.com/EddieTYP/image-prompt-library)
- [Leonxlnx/prompt-library](https://github.com/Leonxlnx/prompt-library)

No code, prompts, text, screenshots, or media from those projects is included.

## Packaged dependencies

JavaScript dependency licenses are recorded by their package metadata and lockfile. They are used for the static gallery and development tests; the runtime theme engine itself uses Node.js built-ins.
