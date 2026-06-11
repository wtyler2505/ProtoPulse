# JLC/LCSC sourcing seed — verified part-number mappings

Source: web verification session 2026-06-11, for the Buyer's sourcing
catalog seed (`content/catalog/jlc-assembly-seed.json`). Each mapping
checked against LCSC/JLCPCB product pages. Basic/extended class is a
snapshot — JLC reclassifies parts; verify at order time. Prices
deliberately NOT captured (they drift faster than anything).

| LCSC | MPN | Mfr | Package | Class (at check) | Maps to seed part |
|---|---|---|---|---|---|
| C25804 | 0603WAF1002T5E | UNI-ROYAL | 0603 | basic | core:resistor @ 10k |
| C21190 | 0603WAF1001T5E | UNI-ROYAL | 0603 | basic | core:resistor @ 1k |
| C14663 | CC0603KRX7R9BB104 | YAGEO | 0603 | basic | core:capacitor @ 100n |
| C2286 | KT-0603R | Hubei KENTO | 0603 | basic | core:led (red) |
| C2128 | 1N4148WS | JSCJ | SOD-323 | basic | core:1n4148 |
| C20526 | MMBT3904 | JSCJ | SOT-23 | basic (per basic-parts lists) | core:2n3904 |
| C7593 | NE555DR | Texas Instruments | SOIC-8 | extended (assumed; TI, unconfirmed) | core:ne555 |
| C47546 | BAT54S,215 | Nexperia | SOT-23 | extended (assumed) | core:bat54s |
| C20917 | AO3400A | AOS | SOT-23 | basic (per basic-parts lists) | core:nmos-ao3400 |

Sources:
- https://jlcpcb.com/partdetail/26547-0603WAF1002T5E/C25804
- https://www.lcsc.com/product-detail/C25804.html
- https://jlcpcb.com/partdetail/Yageo-CC0603KRX7R9BB104/C14663
- https://www.lcsc.com/product-detail/C14663.html
- https://jlcpcb.com/partdetail/2485-1N4148WS/C2128
- https://www.lcsc.com/product-detail/C2128.html
- https://www.lcsc.com/product-detail/C20526.html
- https://jlcpcb.com/partdetail/TexasInstruments-NE555DR/C7593
- https://www.lcsc.com/product-detail/C7593.html
- https://jlcpcb.com/partdetail/Nexperia-BAT54S215/C47546
- https://www.lcsc.com/product-detail/Schottky-Barrier-Diodes-SBD_Nexperia-BAT54S-215_C47546.html
- https://jlcpcb.com/partdetail/Alpha_OmegaSemicon-AO3400A/C20917
- https://www.lcsc.com/product-detail/C20917.html
- https://jlcpcb.com/partdetail/Hubei_KentoElec-KT0603R/C2286
- https://www.lcsc.com/product-detail/C2286.html
- https://www.lcsc.com/product-detail/C21190.html (1k listed in JLCPCB basic libraries)

Note: footprints of our generic seed parts (0805 passives) do not all
match these offers' packages (0603) — the catalog records the offer's
package and the Buyer surfaces the mismatch rather than hiding it.
