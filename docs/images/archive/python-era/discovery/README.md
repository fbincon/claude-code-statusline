# Discovery and import review

<a id="discovery-and-import-review"></a>

**English** | [简体中文](README.zh-CN.md)

**Status:** Historical Python-era capture (backend 1.10.0), not current product behavior. Back to the [image index](../../../README.md).

**Historical behavior note:** these v1.10.0 external-editor captures clip long descriptions at the panel edge without an ellipsis; the current TypeScript external editor adds the ellipsis. The captures retain the historical behavior.

These sixteen PNGs reconstruct actual installed-editor terminal cells from `469c08cbf10526898178d2177a6ffa4f1206ad99` (Linux x86_64, CPython 3.14.4, backend 1.10.0). Native captures use the officially installed Mod on fixed Claude Code 2.1.294 in a direct PTY, avoiding multiplexer RGB conversion. The captured viewports are 120×30; external acceptance also covers 64×18, 64×20, 80×24 and 80×48 in both languages, and native acceptance covers 80×48.

Only the editor is shown: native crops exclude the transcript, composer, live model and private paths. Preview values are fixed samples. Search/guidance examples retain English output independently of interface language; imported candidates choose Chinese output. These are terminal reconstructions, not OS screenshots or human platform acceptance. All sixteen images were inspected for text, clipping, selection and preview readability. Raw cells/logs remain in ignored validation directories.

| Feature | External English | External Chinese | Native English | Native Chinese |
| --- | --- | --- | --- | --- |
| Ranked search | [PNG](external/search-en.png) | [PNG](external/search-zh-CN.png) | [PNG](native/search-en.png) | [PNG](native/search-zh-CN.png) |
| Category filter | [PNG](external/category-en.png) | [PNG](external/category-zh-CN.png) | [PNG](native/category-en.png) | [PNG](native/category-zh-CN.png) |
| Sources and requirements | [PNG](external/guidance-en.png) | [PNG](external/guidance-zh-CN.png) | [PNG](native/guidance-en.png) | [PNG](native/guidance-zh-CN.png) |
| Import differences | [PNG](external/review-en.png) | [PNG](external/review-zh-CN.png) | [PNG](native/review-en.png) | [PNG](native/review-zh-CN.png) |

<details>
<summary>PNG and raw-capture SHA-256 / PNG 与原始捕获 SHA-256</summary>

| File | PNG SHA-256 | Capture SHA-256 |
| --- | --- | --- |
| [discovery/external/search-en.png](external/search-en.png) | `57ab60de6238b46432b50a053fe893d4f65eab8472c8e71f3530a6c0e36ed900` | `239ebe44262c22712ef8e06ad178fa43745f4a41105c645c965ce9d7644a2103` |
| [discovery/external/category-en.png](external/category-en.png) | `13710ad5b99a487ac0fa020fdc138d7442abb7a975ac4513d1e94322aa9183fb` | `92581021434ac3af09e49ec1c74fc79f069d038e31fe9c724db667eda2cb072a` |
| [discovery/external/guidance-en.png](external/guidance-en.png) | `25ab521f4578acd231063149aa36bd4f8ca6d2a377990479376e55bf8464c8e0` | `d0e4dfa6b7f7745819a9d80e19306f5493ba5c5b41fdfc56aff67f461cd5bc9e` |
| [discovery/external/review-en.png](external/review-en.png) | `2240e6bf0ba390750a81c9264182d1c89ee9b2d17ae641b392d29403c25a3fcc` | `2d48acfbc37577b6f68fa84b3386d595211d2c43bad5310351f9ba7a9aead188` |
| [discovery/external/search-zh-CN.png](external/search-zh-CN.png) | `4b9cd7e613d513630790cf222cc0ae1ba56555cc2d73a367e4b4816921846510` | `0055e8ed49feef8d1cc6f40da3a7624d134528c96236052176259daceb81e45c` |
| [discovery/external/category-zh-CN.png](external/category-zh-CN.png) | `e38357d92a0aba3845bc60f650faec9b68e97bcb5a6d1d8e2244a192409d60f3` | `df2934638d84a31f953b0760653127e821e8aadf82fb9bd6cc1083708c8c839f` |
| [discovery/external/guidance-zh-CN.png](external/guidance-zh-CN.png) | `e50baca2cb73fe1ccba8eeae388dce09a03c776331fd8ad8c854647caae0ac3b` | `111b5f02cd9ad98179736f5e2d5a21bfd436ad8ae8e3a396238fd6e1af958c0c` |
| [discovery/external/review-zh-CN.png](external/review-zh-CN.png) | `6523c6390c27dac44d876d1a8b1434c14adf7aa5fa04bfa1863ce3602ae7f987` | `6ef035e278628f45e1b16cdcb3175a3b02f2f683a4186b3c28f7739997393ff0` |
| [discovery/native/search-en.png](native/search-en.png) | `7cd3211728f94ff11bc3fb3e45e357a583282854271350d555959663f4b34392` | `48f9b8c8fff7625710d2d0cadd4330cd2af3855e7a0554be9f0e3acf899a6055` |
| [discovery/native/category-en.png](native/category-en.png) | `ca080c2bd429b6ab80cc98b460e6ec585b07c22b89c44e0f56ad3308703224a2` | `111b5b0ba04f9e7f65ced90554c7080a320823f5c352c0784ec7bd7d9e21e101` |
| [discovery/native/guidance-en.png](native/guidance-en.png) | `b82af6762988cbbc499827770df01fcb92536d714621cdca01256408fc030736` | `a843cfce37a62ef9e954fbdc3983507e7993a8acc66581ce3985052e53d2cb26` |
| [discovery/native/review-en.png](native/review-en.png) | `ddf59835e9279c776cf087b220fa4986e8f1de350a96df24e01ee1a0252d5215` | `0e37e08c250330139523d53d6a6174249693da9d44cde09044ad8849933eafb4` |
| [discovery/native/search-zh-CN.png](native/search-zh-CN.png) | `577b38d508e550900a7a62deb459f4eea56367f0c3caadf939b156f4a4442754` | `1d0a58300069184cf4e20f384abfb41dca2219b9f97a1e66a3e4760bbb0a5cd7` |
| [discovery/native/category-zh-CN.png](native/category-zh-CN.png) | `44676e6e64dbe9ed16c32d9b4586ca1355dbbb52852c6cd3cbc18ce6babb0c00` | `e2823f421bdc38f83587fd829015e71985838ea033dfb5c51f28a1276aa75db1` |
| [discovery/native/guidance-zh-CN.png](native/guidance-zh-CN.png) | `b00f4bd1efe05f4d4e1e5db5cb3eea262d03c989232aa0e467d949782e960de4` | `99d5bb5140ea41fdc97b15d3e03a30436422983a09e751194cfb37a123b9aeee` |
| [discovery/native/review-zh-CN.png](native/review-zh-CN.png) | `9a2537723d3f7212576eb61078b9a8cb2413dd22d4e5aeeed0121777986b9a0f` | `5697b27f6c597c1b17ad5ca489af097f04f5a916e0b696431c9ecdc75a7311ab` |

</details>

<a id="conditional-appearance-captures"></a>
