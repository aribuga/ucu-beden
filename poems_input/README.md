# poems_input

Place user poem `.txt` files in this folder.

Use a single-line `-` separator between poems:

```txt
poem one
continues

-

poem two
continues
```

Only a line that contains `-` by itself is treated as a separator. Hyphens inside poem lines remain part of the poem.

User files in this folder are read as genetic memory and are never overwritten by the scripts.
