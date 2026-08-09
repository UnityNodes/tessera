TESSERA, logo pack (concept "the draw")
========================================

Concept: a finite mosaic pool drawn without replacement.
  - solid gold tiles = still in the pool
  - bright tile with a slot = the case currently being opened
  - faint outlined tiles = already drawn, gone for everybody

COLORS
  Ink / background   #12151A
  Gold (primary)     #D6A441
  Gold bright        #F4CC6A
  Cream (on dark)    #F4F1EA
  Muted gold text    #7A6A47 (light bg) / #A9986F (dark bg)

Typeface (wordmark): set in a neutral sans stack (Inter / Helvetica Neue / Arial).
Swap "Inter" in the lockup SVGs for your brand font. Ideal pairings: Inter,
Geist, or a refined serif (e.g. a Trajan-like face) to echo the Roman origin
of the word "tessera".

------------------------------------------------------------
FILES
------------------------------------------------------------
svg/   (vector, scales to any size, use these on the web wherever possible)
  tessera-mark.svg            full color app-icon mark (dark tile + gold grid)
  tessera-favicon.svg         simplified mark (no thin outlines) for small sizes
  tessera-mark-mono.svg       one color, uses currentColor (set via CSS `color`)
  tessera-mark-white.svg      white knockout for dark backgrounds / photos
  tessera-lockup-light.svg    mark + wordmark, dark text (light backgrounds)
  tessera-lockup-dark.svg     mark + wordmark, light text (dark backgrounds)

png/   (raster, transparent background)
  tessera-icon-16/32/48.png             small (from simplified mark)
  tessera-icon-64/128/180/192/256/512/1024.png   full mark
  apple-touch-icon-180.png              iOS home-screen icon
  tessera-mark-black-512/1024.png       one-color dark
  tessera-mark-white-512/1024.png       one-color white
  tessera-lockup-light-800x200 / 1600x400.png
  tessera-lockup-dark-800x200 / 1600x400.png

favicon.ico   multi-size icon (16 + 32 + 48) for browsers

------------------------------------------------------------
WEB SETUP (drop in <head>)
------------------------------------------------------------
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" type="image/svg+xml" href="/tessera-favicon.svg">
  <link rel="apple-touch-icon" href="/apple-touch-icon-180.png">
  <meta name="theme-color" content="#12151A">

Open-Graph / social preview: use tessera-lockup-dark-1600x400.png
or tessera-icon-1024.png.
