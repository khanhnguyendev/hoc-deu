# Self-hosted fonts

The build must work offline (platform design §2.1, §6.8): the daily bot runs `pnpm verify` inside
a network that only allows the app domain and package registries. **Never switch back to
`next/font/google`** — ESLint and `tools/guards/offline-build.test.ts` fail if anything references
Google Fonts, and CI builds with the Google Fonts hosts blocked.

| Family         | Files                                                                | Version | License                                |
| -------------- | -------------------------------------------------------------------- | ------- | -------------------------------------- |
| Be Vietnam Pro | `be-vietnam-pro/be-vietnam-pro-{400,500,600,700}.woff2`              | 1.002   | SIL OFL 1.1 (`be-vietnam-pro/OFL.txt`) |
| JetBrains Mono | `jetbrains-mono/jetbrains-mono-variable.woff2` (weight axis 100–800) | 2.211   | SIL OFL 1.1 (`jetbrains-mono/OFL.txt`) |

Loaded with `next/font/local` in `fonts.ts` (CSS variables `--font-be-vietnam-pro` and
`--font-jetbrains-mono`, used by `--font-sans` / `--font-mono` in the tokens).

## Source and subsetting

Source: [`google/fonts`](https://github.com/google/fonts) at commit
`b5efa9c32e8f9b63005f5cdb1ad5527a77d2cd04` — `ofl/bevietnampro/BeVietnamPro-{Regular,Medium,SemiBold,Bold}.ttf`,
`ofl/jetbrainsmono/JetBrainsMono[wght].ttf` and each folder's `OFL.txt`. Neither license declares a
Reserved Font Name, so subsetting is allowed.

The files are subset to Google Fonts' `latin` + `vietnamese` ranges with
[fontTools](https://github.com/fonttools/fonttools) (a local tool in a throwaway virtualenv —
`pip install fonttools brotli` — not a project dependency):

```bash
U='U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD,U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB'
for w in Regular:400 Medium:500 SemiBold:600 Bold:700; do
  pyftsubset "BeVietnamPro-${w%%:*}.ttf" --unicodes="$U" --layout-features='*' --flavor=woff2 \
    --output-file="be-vietnam-pro/be-vietnam-pro-${w##*:}.woff2"
done
pyftsubset 'JetBrainsMono[wght].ttf' --unicodes="$U" --layout-features='*' --flavor=woff2 \
  --output-file=jetbrains-mono/jetbrains-mono-variable.woff2
```
