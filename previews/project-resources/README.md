# Focused architecture previews

Open [the gallery](index.html). Five synthetic desktop/mobile layouts show task instruction editing, a scheduled-date exception, volunteer disclosure, one site-map management card and a map viewer. Extra captures show an opened assignment disclosure and mobile zoom. The mockups do not save, upload, authenticate or send email.

From the repository root, a local isolated preview server can be started with `python -m http.server 8767 --bind 127.0.0.1 --directory previews/project-resources`. The folder contains only fictional map geometry, example names and sample instructions. No original Belgrade PDF or production contact is included.

Colors, heading sizes, compact cards and focus treatment follow the checked-in 12.48 design foundation. The implementation should use the actual shared React components. The old eight-screen library/security previews remain available in Git history at `edd1114`.
