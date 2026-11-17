# Institution Intelligence — QA Phase 2: NUC Identity Reconciliation

**Audit date:** 17 November 2026  
**Branch:** `data/institution-intelligence-foundation`  
**Inventory source:** `data/institutions/institution-inventory-329.json`  
**Primary comparison source:** NUC Nigerian University System directory, live directory page: https://enuc.nuc.edu.ng/nus  
**Scope:** 329 production inventory rows compared against the NUC directory's main nationwide university table and cross-checked against the same page's geopolitical-zone lists.  
**Safety:** This is a documentation-only audit. No production Supabase data was read or changed beyond the supplied inventory export; no production records were mutated.

## 1. Executive summary

The NUC directory page's main nationwide table reports **328 universities** and its ownership summary reports **77 federal, 69 state and 182 private universities**. The table includes one University of Calabar entry, displayed as **University of Calabar, Calabar**. The inventory contains 329 rows, including two separate University of Calabar rows with different UUIDs.

The 329 inventory rows reduce to **328 distinct institutional identities** when the two Calabar rows are treated as one candidate identity. This reconciles the inventory row count to the NUC table count at the aggregate level. It is a strong reconciliation result, but it is not permission to delete or merge either UUID.

**Important limitation:** the NUC page is internally inconsistent. Its geographic-zone list includes **Pen Resource University, Gombe** and **Gombe State University of Science and Technology, Kumo**, neither of which appears as a separate row in the main nationwide table. The zone list instead contains Gombe State University, Gombe, which is the name present in the main table and inventory. Therefore, this report treats the main nationwide table as the primary match source and records the zone-list anomalies separately; the NUC page needs clarification before these two names can be treated as independent licensed institutions.

## 2. Aggregate reconciliation

| Measure | Result |
|---|---:|
| EduReach inventory rows | 329 |
| NUC nationwide table count | 328 |
| Inventory exact normalized-name duplicates | 0 |
| Strong semantic duplicate candidates | 1 pair (University of Calabar) |
| Distinct inventory identities after provisional Calabar deduplication | 328 |
| Required-field omissions (name, state, UUID, type) | 0 |
| Ownership field in current inventory schema | Not present |

## 3. Row-by-row inventory mapping

**Status key:** `Listed — normalized identity match` means the institution is represented in the NUC nationwide table; spelling, punctuation, and location suffixes may differ. `Duplicate candidate` means the row is a second EduReach UUID for the same NUC-listed institution and must not be treated as a second university. NUC ownership is not represented in the source inventory schema, so ownership classification is not inferred from the row's generic `institutionType: university` value.

| # | EduReach institution | Inventory state | Institution UUID | NUC identity reconciliation |
|---:|---|---|---|---|
| 1 | Abdulfattah Durojaiye University, Abeokuta | Ogun | `337cecd3-ed57-46f6-b81c-33ff9a971653` | Listed — normalized identity match |
| 2 | Abdulkadir Kure University, Minna | Niger | `afa509bc-fb6a-4dfb-ba8c-b88d5601038e` | Listed — normalized identity match |
| 3 | Abdulrasaq Abubakar Toyin University, Oke-Agba | Kwara | `940ea617-ba4c-4fca-94fd-b16ae2e8bf31` | Listed — normalized identity match |
| 4 | Abdulsalami Abubakar University of Agriculture and Climate Action, Mokwa | Niger | `082933fb-e3f5-4e7b-818e-53392a85c336` | Listed — normalized identity match |
| 5 | Abia State University, Uturu | Abia | `d6910190-54a4-4c72-993d-c67ac72594c5` | Listed — normalized identity match |
| 6 | Abubakar Tafawa Balewa University, Bauchi | Bauchi | `6a75a5e3-81d8-43fe-b951-a5b031447339` | Listed — normalized identity match |
| 7 | Achievers University, Owo | Ondo | `cdf774d4-dae8-493d-93c5-8d23c6ec501c` | Listed — normalized identity match |
| 8 | Adamawa State University, Mubi | Adamawa | `c150e96e-c2a1-4da3-b995-480ee5a4819c` | Listed — normalized identity match |
| 9 | Adeche Momoh University, Igarra | Edo | `4173759b-d3c9-4b75-8f86-cf8f01d9559c` | Listed — normalized identity match |
| 10 | Adekunle Ajasin University, Akungba-Akoko | Ondo | `73c46ac6-e7d1-4d77-84b8-eac47435ea1d` | Listed — normalized identity match |
| 11 | Adeleke University, Ede | Osun | `0ca1ee1a-6003-4840-8cfa-8a806653fda3` | Listed — normalized identity match |
| 12 | Adeyemi Federal University of Education, Akure | Ondo | `7a74e01e-c57f-4117-8147-8c16cec72381` | Listed — normalized identity match |
| 13 | Admiralty University, Ibusa | Delta | `8d0fda97-70f2-4873-9298-5b3b106baf23` | Listed — normalized identity match |
| 14 | Afe Babalola University, Ado-Ekiti | Ekiti | `ac3bc3c5-c59c-4c3d-911c-eac82e016fa2` | Listed — normalized identity match |
| 15 | African Aviation and Aerospace University, Abuja | FCT Abuja | `f6e79568-cbb1-414c-947b-2835caed7c79` | Listed — normalized identity match |
| 16 | African School of Economics, Abuja | FCT Abuja | `e3054006-c3de-4522-aef8-3098559df8ac` | Listed — normalized identity match |
| 17 | African University of Science & Technology, Abuja | FCT Abuja | `814bd683-3b83-4c93-9dd2-80d6f5ea50f6` | Listed — normalized identity match |
| 18 | Ahmadu Bello University, Zaria | Kaduna | `d582bec5-d9f3-4b7d-a53b-12581dac0175` | Listed — normalized identity match |
| 19 | Ahman Pategi University, Patigi | Kwara | `608c6ef3-3e31-411e-8f3b-b931ae570779` | Listed — normalized identity match |
| 20 | Air Force Institute of Technology, Kaduna | Kaduna | `e7d9f2a1-d79a-42c0-be70-252dc0b48023` | Listed — normalized identity match |
| 21 | Ajayi Crowther University, Ibadan | Oyo | `32a9cd29-701f-42d0-8a5e-7fc11be12b9b` | Listed — normalized identity match |
| 22 | Akwa Ibom State University, Ikot Akpaden | Akwa Ibom | `a22bb5a1-cb65-45e2-9501-f02a683365f3` | Listed — normalized identity match |
| 23 | Al-Ansar University, Maiduguri | Borno | `4f3a6d8b-afda-4bb9-979f-b5e64149c19a` | Listed — normalized identity match |
| 24 | Al-Bayan University, Ankpa | Kogi | `359b37ac-4e10-435f-b318-d9d8b465e8c3` | Listed — normalized identity match |
| 25 | Al-Hikmah University, Ilorin | Kwara | `b82596fa-4f97-4f65-9786-b6270d2ab402` | Listed — normalized identity match |
| 26 | Al-Istiqama University, Sumaila | Kano | `c2eb83a3-ea26-43ce-b32b-1505bd0a16d9` | Listed — normalized identity match |
| 27 | Al-Muhibbah Open University, Abuja | FCT Abuja | `481e4f42-65a8-460e-89dc-e3b291f8bf81` | Listed — normalized identity match |
| 28 | Al-Qalam University, Katsina | Katsina | `340e7568-40e4-4b5e-9c9e-be9e0c740d14` | Listed — normalized identity match |
| 29 | Aletheia University, Ago-Iwoye | Ogun | `930fc92f-a2d2-4ccb-929a-0b7a53fb11e4` | Listed — normalized identity match |
| 30 | Alex Ekwueme Federal University, Ndufu Alike | Ebonyi | `caf0ebd2-59f3-478a-a3d4-02db121382b0` | Listed — normalized identity match |
| 31 | Aliko Dangote University of Science & Technology, Wudil | Kano | `51c9da9a-6c8e-451f-b3af-5a9e60c38a26` | Listed — normalized identity match |
| 32 | Alvan Ikoku Federal University of Education, Owerri | Imo | `d21a8d7e-0050-4968-8b4d-905b977b9bbb` | Listed — normalized identity match |
| 33 | Amadeus University, Amizi | Abia | `7fe622e9-ac98-4db8-94bc-e9b4f6f750e7` | Listed — normalized identity match |
| 34 | Amaj University, Abuja | FCT Abuja | `81a1b1e9-ada4-47f0-a154-87eecf0345ff` | Listed — normalized identity match |
| 35 | Ambrose Alli University, Ekpoma | Edo | `19856fe1-39c6-4b04-8c50-e557b256f3ec` | Listed — normalized identity match |
| 36 | American Open University, Abeokuta | Ogun | `351203e2-83b9-4abb-9349-3c4dfc934879` | Listed — normalized identity match |
| 37 | American University of Nigeria, Yola | Adamawa | `562718a7-af40-4762-9a5a-7c573662efc0` | Listed — normalized identity match |
| 38 | ANAN University, Kwall | Plateau | `941b83c3-f2f7-4cc0-828f-576ad3dbf397` | Listed — normalized identity match |
| 39 | Anchor University, Ayobo | Lagos | `2bfbbeac-2d2b-4f25-908d-babaea3e81d0` | Listed — normalized identity match |
| 40 | Arthur Jarvis University, Akpabuyo | Cross River | `1e5b71fb-5ebd-41d2-82cf-6f3303cceabc` | Listed — normalized identity match |
| 41 | Atiba University, Oyo | Oyo | `c64590f2-e814-416e-a2f1-23cd67dd9ebf` | Listed — normalized identity match |
| 42 | Augustine University, Ilara | Lagos | `029504a6-5de8-4d21-80d5-992eb599a470` | Listed — normalized identity match |
| 43 | Ave-Maria University, Piyanko | Nasarawa | `3c90bcce-be12-4219-a64f-dcf33cd7eddb` | Listed — normalized identity match |
| 44 | Azione Verde University, Amaigbo | Imo | `782cad2b-a4ae-468e-b1cb-19713ebf94d3` | Listed — normalized identity match |
| 45 | Azman University, Kano | Kano | `1fe3df06-f185-4677-9e55-4b26348f2263` | Listed — normalized identity match |
| 46 | Baba-Ahmed University, Kano | Kano | `a8da8d42-fc6c-4746-aa4b-fcaa63b8faa9` | Listed — normalized identity match |
| 47 | Babcock University, Ilishan-Remo | Ogun | `a5a80e72-f331-4f03-8088-9a85956cd3a5` | Listed — normalized identity match |
| 48 | Bamidele Olumilua University of Education Science and Technology, Ikere | Ekiti | `36e2f1dd-b2e8-465e-9760-8b5de777b38d` | Listed — normalized identity match |
| 49 | Bayelsa Medical University, Yenagoa | Bayelsa | `c0afd9a3-18c7-4e08-bb60-8aa0aab4f639` | Listed — normalized identity match |
| 50 | Bayero University, Kano | Kano | `8fec2f14-5e7b-46f6-8342-e6269fd622a4` | Listed — normalized identity match |
| 51 | Baze University, Abuja | FCT Abuja | `1fc72a03-794f-4c27-8e7b-c9678e47e397` | Listed — normalized identity match |
| 52 | Bells University of Technology, Otta | Ogun | `d9315e95-a440-46e6-8b4e-15f7ec476d05` | Listed — normalized identity match |
| 53 | Benson Idahosa University, Benin City | Edo | `c2a7c867-889d-4ba9-a0c7-d40e9d3dd58e` | Listed — normalized identity match |
| 54 | Benue State University of Agriculture, Science and Technology, Ihugh | Benue | `0ddadc20-399f-40d9-a419-43ceef22f001` | Listed — normalized identity match |
| 55 | Bingham University, New-Karu | Nasarawa | `6d1e4c8d-99ed-4714-a015-64aab00db4dc` | Listed — normalized identity match |
| 56 | Borno State University | Borno | `f91e938d-d567-4019-a0ac-4ff0e17eeafd` | Listed — normalized identity match |
| 57 | Bowen University, Iwo | Ogun | `9e96b97a-6be5-4a41-943a-1939f1b7703b` | Listed — normalized identity match |
| 58 | Bridget University Mbaise | Imo | `fa56a155-2210-4856-a783-3e27f55cb402` | Listed — normalized identity match |
| 59 | British Canadian University, Obudu | Cross River | `048b536d-2749-4dcb-880e-689590246055` | Listed — normalized identity match |
| 60 | Caleb University, Imota | Lagos | `5722a093-df07-468d-ad58-597e91a859cb` | Listed — normalized identity match |
| 61 | Canadian University of Nigeria, Abuja | FCT Abuja | `0039147a-ecb5-4a7a-9082-d80be609e6cb` | Listed — normalized identity match |
| 62 | Capital City University, Kano | Kano | `de1f9fc7-d1e1-4360-a5fd-bad41a479f29` | Listed — normalized identity match |
| 63 | Caritas University, Enugu | Enugu | `b3678d09-c913-443a-81c9-bddd122fa8c3` | Listed — normalized identity match |
| 64 | Chrisland University, Owode | Ogun | `7c4763d1-81dd-41ae-8cd9-eb57b889b64a` | Listed — normalized identity match |
| 65 | Christopher University, Mowe | Ogun | `b9dbc7e7-6ffe-4653-be7e-fcf81d109988` | Listed — normalized identity match |
| 66 | Chukwuemeka Odumegwu Ojukwu University, Uli | Anambra | `ca1d676b-9322-4c81-a05c-1d8cf87a0d70` | Listed — normalized identity match |
| 67 | City University, Abuja | FCT Abuja | `e24cf7b5-a38d-4fc1-9fe2-312c00ed6c29` | Listed — normalized identity match |
| 68 | Claretian University of Nigeria, Nekede | Imo | `91b6d714-7454-4008-a456-641588738ec1` | Listed — normalized identity match |
| 69 | Clifford University, Owerrinta | Abia | `1356f728-7f82-4240-9dad-cdd66186275d` | Listed — normalized identity match |
| 70 | Coal City University, Enugu | Enugu | `1c8c2820-15d8-4a1a-874b-73c8623a2f3a` | Listed — normalized identity match |
| 71 | College of Petroleum and Energy Studies, Kaduna | Kaduna | `ddeb513f-60fb-46d7-ba1b-5fa0e9068f2b` | Listed — normalized identity match |
| 72 | Confluence University of Science and Technology, Osara | Kogi | `42f6852f-5a1c-4576-a17e-946b4f034d98` | Listed — normalized identity match |
| 73 | Cosmopolitan University, Abuja | FCT Abuja | `0f09efb3-d706-4633-9204-883db35d9c6a` | Listed — normalized identity match |
| 74 | Covenant University, Otta | Ogun | `7db2018f-a0a7-41d9-8dde-0beb268f1ed2` | Listed — normalized identity match |
| 75 | Crawford University, Igbesa | Ogun | `d3725bff-d5dd-4002-828b-94acd9273b99` | Listed — normalized identity match |
| 76 | Crescent University, Abeokuta | Ogun | `835b2eab-e704-4295-a039-c97e7aaa5388` | Listed — normalized identity match |
| 77 | Cross River University of Education and Entrepreneurship, Akampa | Cross River | `42fdee56-1c32-4c68-8634-98bf36cf58bd` | Listed — normalized identity match |
| 78 | Cross River University of Technology, Calabar | Cross River | `eb6e1c7b-bbc7-4eca-bfa7-f1dc302dfbbb` | Listed — normalized identity match |
| 79 | Delta State University, Abraka | Delta | `eda71738-fa45-4f71-b861-43fdd351cbb7` | Listed — normalized identity match |
| 80 | Dennis Osadebey University, Asaba | Delta | `aa20322a-cdfc-4447-87aa-20939fcaa4fd` | Listed — normalized identity match |
| 81 | Dominican University, Ibadan | Oyo | `1401e847-0ef8-46b8-a344-c099d8959b66` | Listed — normalized identity match |
| 82 | Dominion University, Ibadan | Oyo | `d85098c4-c308-4f73-b476-612f0ad5d101` | Listed — normalized identity match |
| 83 | Ebonyi State University of Aeronautics and Aerospace Engineering, Ezza | Ebonyi | `83adabe1-71c2-4386-bf47-25d663629f3f` | Listed — normalized identity match |
| 84 | Ebonyi State University of ICT, Science and Technology, Oferekpe | Ebonyi | `71020ab9-ba11-4b88-ad77-6b7dde272ed2` | Listed — normalized identity match |
| 85 | Ebonyi State University, Abakaliki | Ebonyi | `ac37f1ca-6374-4425-bec0-4fa058da1da2` | Listed — normalized identity match |
| 86 | Edo University, Iyamho | Edo | `76fdb38d-7294-4476-b6e2-cdc51635b3fc` | Listed — normalized identity match |
| 87 | Edusoko University, Bida | Niger | `f7a573e6-be20-4761-a964-f4e7096d8820` | Listed — normalized identity match |
| 88 | Edwin Clark University, Kiagbodo | Delta | `e96f3998-044a-46ff-9f12-4941ac42452a` | Listed — normalized identity match |
| 89 | Ekiti State University, Ado-Ekiti | Ekiti | `d9134804-bc50-4083-a27e-fedd85f10da3` | Listed — normalized identity match |
| 90 | Eko University of Medical Sciences, Ijanikin | Lagos | `c41bf9d8-d27c-4681-aba3-3561c398bf9f` | Listed — normalized identity match |
| 91 | El-Amin University, Niger State | Niger | `d6017dcd-9f1e-41f1-aa8c-daacc33ddd3f` | Listed — normalized identity match |
| 92 | Elizade University, Ilara-Mokin | Ondo | `15214907-e367-4af3-9e6f-b601cb5c9bd0` | Listed — normalized identity match |
| 93 | Elrazi University of Medical Sciences, Kano | Kano | `a7c3c010-02f0-44fc-9657-d87e0b781e58` | Listed — normalized identity match |
| 94 | Emmanuel Alayande University of Education, Oyo | Oyo | `10057048-673c-44b3-9d62-c6444a53f612` | Listed — normalized identity match |
| 95 | Enugu State University of Medical and Applied Sciences, Igbo-Eno | Enugu | `97fddb65-5779-40f6-bad2-b5cfa31a9eb9` | Listed — normalized identity match |
| 96 | Enugu State University of Science & Technology, Enugu | Enugu | `8874912c-cd58-4d4d-9db0-1d880a6e6995` | Listed — normalized identity match |
| 97 | Eranova University, Abuja | FCT Abuja | `d5dfe98e-a022-4c26-97c3-a7dbc4d7d477` | Listed — normalized identity match |
| 98 | European University of Nigeria, Abuja | FCT Abuja | `3b729849-b036-4453-b672-8ba8be641576` | Listed — normalized identity match |
| 99 | Euston University, Abakaliki | Ebonyi | `84e21a5f-827d-4c26-9103-0a70c3626626` | Listed — normalized identity match |
| 100 | Evangel University, Akaeze | Ebonyi | `0a85612e-ef68-490e-af15-bde7e44b9c19` | Listed — normalized identity match |
| 101 | Federal University of Agriculture and Developmental Studies, Iragbiji | Osun | `f20ca3a8-1a2b-4d75-9a04-9b9a412da9e7` | Listed — normalized identity match |
| 102 | Federal University of Agriculture and Technology Obio-Akpa | Akwa Ibom | `efa3e518-a54e-4cc2-a126-f6e3f865b9e7` | Listed — normalized identity match |
| 103 | Federal University of Agriculture and Technology, Okeho | Oyo | `884e7d54-bedb-41ea-864c-a41f8049a682` | Listed — normalized identity match |
| 104 | Federal University of Agriculture, Abeokuta | Ogun | `f0cbbb03-039a-4dca-a1b7-32062cd226f5` | Listed — normalized identity match |
| 105 | Federal University of Agriculture, Bassam-Bari | Bayelsa | `6fd1425f-3829-4120-8710-cac192297249` | Listed — normalized identity match |
| 106 | Federal University of Agriculture, Mubi | Adamawa | `4414c55d-8802-477e-957f-3ccb4fccd0ed` | Listed — normalized identity match |
| 107 | Federal University of Agriculture, Zuru | Kebbi | `ddaff2bd-c68b-4fef-9070-54a9eda425ab` | Listed — normalized identity match |
| 108 | Federal University of Allied Health Sciences, Enugu | Enugu | `9ff36003-0537-4b4d-9021-8501d7118540` | Listed — normalized identity match |
| 109 | Federal University of Applied Sciences, Kachia | Kaduna | `2579402f-45ba-4c96-b770-51e66086bb40` | Listed — normalized identity match |
| 110 | Federal University of Education, Kantagora | Niger | `44ba68af-8f8b-45a7-85da-3db789517a24` | Listed — normalized identity match |
| 111 | Federal University of Education, Pankshin | Plateau | `22533318-18e1-4d4d-a4a3-b6ba783e4dda` | Listed — normalized identity match |
| 112 | Federal University of Education, Zaria | Kaduna | `d77c4b72-c813-4ad7-961d-015a85be65c4` | Listed — normalized identity match |
| 113 | Federal University of Environment and Technology, Tai Town | Rivers | `f1acaea6-22ef-4689-97a5-9bc0d2364530` | Listed — normalized identity match |
| 114 | Federal University of Health Science and Technology, Tsafe | Zamfara | `845af8ad-76c3-430a-94e9-d20b6704665f` | Listed — normalized identity match |
| 115 | Federal University of Health Sciences, Azare | Bauchi | `562cc2ce-f11e-4ed7-9b43-042fa94f9c02` | Listed — normalized identity match |
| 116 | Federal University of Health Sciences, Funtua | Katsina | `38e5b6fc-017d-4045-acd0-f0f311a0de4a` | Listed — normalized identity match |
| 117 | Federal University of Health Sciences, Ila Orangun | Osun | `a413c221-219a-4120-a187-d4dc9586f1e6` | Listed — normalized identity match |
| 118 | Federal University of Health Sciences, Kwale | Delta | `ce43ae2c-e875-4da4-9867-18441755435a` | Listed — normalized identity match |
| 119 | Federal University of Health Sciences, Otukpo | Benue | `e503b3d9-28dc-47a5-aa6f-1b50000eeb36` | Listed — normalized identity match |
| 120 | Federal University of Medicine and Medical Sciences, Abeokuta | Ogun | `abc76365-b7ee-45a6-b2d0-43f2c1c0e903` | Listed — normalized identity match |
| 121 | Federal University of Petroleum Resources, Effurun | Delta | `bfa7357b-3e08-4181-a63c-82e08a4e15f5` | Listed — normalized identity match |
| 122 | Federal University of Science and Technology, Epe | Lagos | `3dceafed-26c2-4314-9ba4-8c0edb9432a9` | Listed — normalized identity match |
| 123 | Federal University of Science and Technology, Kabo | Kano | `d6c1cb69-7928-41c1-85c5-d28990d12443` | Listed — normalized identity match |
| 124 | Federal University of Technology and Environmental Studies, Iyin-Ekiti | Ekiti | `68b6c668-50c3-43b2-b69c-a6bc8c2e9520` | Listed — normalized identity match |
| 125 | Federal University of Technology Ikot Abasi | Akwa Ibom | `731f7b15-8931-4168-a7fa-b689ec0f9c70` | Listed — normalized identity match |
| 126 | Federal University of Technology, Akure | Ondo | `ed25c06d-981b-452d-a80b-9a6c92cfaa71` | Listed — normalized identity match |
| 127 | Federal University of Technology, Babura | Jigawa | `3be1a89d-3af8-42e6-9872-3b44df69dff8` | Listed — normalized identity match |
| 128 | Federal University of Technology, Minna | Niger | `5fa39e65-48eb-4cfb-a6d4-75202e3f6ab6` | Listed — normalized identity match |
| 129 | Federal University of Technology, Owerri | Imo | `2552d5b7-34b8-42e3-a38e-0e6055399575` | Listed — normalized identity match |
| 130 | Federal University of Transportation, Daura | Katsina | `1d2148d2-ca8d-485b-b173-5e431c1f3a07` | Listed — normalized identity match |
| 131 | Federal University, Birnin-Kebbi | Kebbi | `8d5fa3e5-da08-4f74-990d-f713bd6a369b` | Listed — normalized identity match |
| 132 | Federal University, Dutse | Jigawa | `66425cb8-ab20-4edb-ba3e-7673499a976d` | Listed — normalized identity match |
| 133 | Federal University, Dutsin-Ma | Katsina | `8deddfbc-eecd-4a1b-9be0-04aa3934e873` | Listed — normalized identity match |
| 134 | Federal University, Gashua | Yobe | `060d8fb7-fa02-4038-952e-0f481b1ec1c2` | Listed — normalized identity match |
| 135 | Federal University, Gusau | Zamfara | `f8b0e066-8f34-40e5-a6f1-583862fc3123` | Listed — normalized identity match |
| 136 | Federal University, Kashere | Gombe | `872252b7-9f0b-4bad-b712-f93d196cc27f` | Listed — normalized identity match |
| 137 | Federal University, Lafia | Nasarawa | `9168037b-ea7c-4f91-bf1d-b71ffd570652` | Listed — normalized identity match |
| 138 | Federal University, Lokoja | Kogi | `00d0cd95-7e47-46f8-88c9-7736b2f291e2` | Listed — normalized identity match |
| 139 | Federal University, Otuoke | Bayelsa | `d9975d6b-36e7-46c3-a474-23b76b3c2a47` | Listed — normalized identity match |
| 140 | Federal University, Oye-Ekiti | Ekiti | `1fe33665-fdc2-43c4-9385-b90dcae310a0` | Listed — normalized identity match |
| 141 | Federal University, Wukari | Taraba | `7eef5c6e-3add-428e-accb-5bbe829a9540` | Listed — normalized identity match |
| 142 | First Technical University, Ibadan | Oyo | `ed93e671-37a3-4e49-872e-ef05ecddd957` | Listed — normalized identity match |
| 143 | Fountain University, Oshogbo | Osun | `904f4a75-e1d0-400d-a0dc-c323120a6aad` | Listed — normalized identity match |
| 144 | Franco British International University, Kaduna | Kaduna | `ce6cc1f7-f7b8-4f65-9c6f-11319acc7335` | Listed — normalized identity match |
| 145 | Gerar University of Medical Sciences, Imope-Ijebu | Ogun | `b6df62f0-0c32-42bb-a710-36064b3b4fec` | Listed — normalized identity match |
| 146 | Glorious Vision University, Ogwa | Edo | `61b22d60-5ef9-4642-b18a-7c3f36ba3947` | Listed — normalized identity match |
| 147 | Godday Erewa University, Sapele | Delta | `1219894e-8d58-4909-9af4-6d4cb52fba41` | Listed — normalized identity match |
| 148 | Godfrey Okoye University, Enugu | Enugu | `248912ac-393c-483a-a229-66f9790abf14` | Listed — normalized identity match |
| 149 | Gombe State University, Gombe | Gombe | `cf310659-5d12-4abd-ab8e-2c61cd0873a6` | Listed — normalized identity match |
| 150 | Greenfield University, Kaduna | Kaduna | `cf1b3803-1c93-45d3-afbe-c97d8536c26a` | Listed — normalized identity match |
| 151 | Greenland University, Jalingo | Taraba | `9f11ac22-ba14-46f2-b2ca-69630e9cde04` | Listed — normalized identity match |
| 152 | Gregory University, Uturu | Abia | `4e908750-9eb7-43e6-a00b-106cf848be04` | Listed — normalized identity match |
| 153 | Hallmark University, Ijebu-Itele | Ogun | `c89b513e-df65-4f2b-ab49-14da4fb71946` | Listed — normalized identity match |
| 154 | Havilla University, Nde-Ikom | Cross River | `0ebf3431-cce8-46cc-a7a5-ab765d1f3c5b` | Listed — normalized identity match |
| 155 | Hensard University, Toru-Orua | Bayelsa | `d875d62c-4df8-4ef1-8b5d-b4285b3ce9a4` | Listed — normalized identity match |
| 156 | Hezekiah University, Umudi | Imo | `5a9f2e5f-a99c-432a-8a92-c92c49788e71` | Listed — normalized identity match |
| 157 | High-Flyers University, Ikere-Ekiti | Ekiti | `f3bde218-0e54-4060-8af8-c9a99ce8ed4a` | Listed — normalized identity match |
| 158 | Hillside University of Science and Technology, Okemesi Ekiti | Ekiti | `524c5feb-b7e9-41e3-944b-a8dd42ee3ef4` | Listed — normalized identity match |
| 159 | Huda University, Gusau | Zamfara | `c39c93d9-4292-4929-9812-1a5cde284607` | Listed — normalized identity match |
| 160 | Ibrahim Badamasi Babangida University, Lapai | Niger | `09d7b948-ca4c-4231-bf35-fd92213db166` | Listed — normalized identity match |
| 161 | Iconic Open University, Sokoto | Sokoto | `535e71c1-a4e5-46bd-b3b5-92158af3ee43` | Listed — normalized identity match |
| 162 | Igbinedion University, Okada | Edo | `34e34af1-b524-4e1c-ae7c-2f934bdf843f` | Listed — normalized identity match |
| 163 | Ignatius Ajuru University of Education, Rumuolumeni | Rivers | `84abd3ad-0441-4b3a-9b11-08f1aac6c490` | Listed — normalized identity match |
| 164 | Imo State University, Owerri | Imo | `adb22f3b-5058-44d1-89f4-54c08d42e81d` | Listed — normalized identity match |
| 165 | Isaac Balami University of Aeronautics and Management | Lagos | `a8576d07-3ac2-4b34-a8fd-d3d457ac9093` | Listed — normalized identity match |
| 166 | James Hope University, Lekki | Lagos | `513dad28-15b5-44a0-8f1f-326ca48888b2` | Listed — normalized identity match |
| 167 | JEFAP University, Suleja | Niger | `50a83a78-5c84-413f-ac99-4755cbbc6a46` | Listed — normalized identity match |
| 168 | Jewel University, Gombe | Gombe | `c98e2af5-2adb-4f40-bbb4-80676c497088` | Listed — normalized identity match |
| 169 | Jigawa State University of Allied and Medical Science | Jigawa | `2dbc868b-0f03-4727-ba4b-1642478d629f` | Listed — normalized identity match |
| 170 | Jimoh Babalola University, Ilorin | Kwara | `5e7654d4-754b-454a-92c1-5c9e699636b5` | Listed — normalized identity match |
| 171 | Joseph Ayo Babalola University, Ikeji-Arakeji | Osun | `4dd65fdd-befc-479c-8878-329f6769fd88` | Listed — normalized identity match |
| 172 | Joseph Sarwuan Tarka University, Makurdi | Benue | `f7cc6da0-267b-48f5-8dfe-7ee6413379c4` | Listed — normalized identity match |
| 173 | Kaduna State University, Kaduna | Kaduna | `f5461ce3-9056-45fc-b6b0-3bec62fa3c1f` | Listed — normalized identity match |
| 174 | Karl-Kumm University, Vom | Plateau | `b5b5dad4-cf93-4fa8-acca-0150a90d906a` | Listed — normalized identity match |
| 175 | Kebbi State University of Science and Technology, Aliero | Kebbi | `6b36c027-baba-4eb6-843d-35940146afdf` | Listed — normalized identity match |
| 176 | Kevin Eze University, Mgbowo | Enugu | `00a5d148-097a-4e40-b7e8-d18c6ec799fe` | Listed — normalized identity match |
| 177 | Khalifa Isiyaku Rabiu University, Kano | Kano | `3fba17fd-0dbc-461a-a708-200eae85d6ec` | Listed — normalized identity match |
| 178 | King David Umahi University of Medical Sciences, Uburu | Ebonyi | `31485818-a4b3-4d9d-9e66-9bd6215991e6` | Listed — normalized identity match |
| 179 | Kings University, Ode-Omu | Osun | `934fb37a-16bd-4e1e-92c0-6cd95af36ffc` | Listed — normalized identity match |
| 180 | Kingsley Ozumba Mbadiwe University | Imo | `c2c728db-9f44-410b-9804-8faa0fc9c31c` | Listed — normalized identity match |
| 181 | Kogi State University, Kabba | Kogi | `0a90bab1-3383-47ac-b285-fe846f8695bf` | Listed — normalized identity match |
| 182 | Kola Daisi University, Ibadan | Oyo | `b25573f3-f32e-4465-9125-1f1048d20e45` | Listed — normalized identity match |
| 183 | Kwara State University of Education, Ilorin | Kwara | `ddf32a6b-1143-44e0-940e-20749b8bb53b` | Listed — normalized identity match |
| 184 | Kwara State University, Ilorin | Kwara | `91956498-fbdb-46f2-92c0-fe8ec9d2b741` | Listed — normalized identity match |
| 185 | Kwararafa University, Wukari | Taraba | `230185e7-8a5e-4470-abb0-69f2da11856e` | Listed — normalized identity match |
| 186 | Ladoke Akintola University of Technology, Ogbomoso | Oyo | `c8d60229-64d5-4521-9f31-c64179f949d0` | Listed — normalized identity match |
| 187 | Lagos State University, Ojo | Lagos | `b37f857f-7dca-4cde-be31-c975e79ef3bb` | Listed — normalized identity match |
| 188 | Lagos University of Education, Oto/Ijanikin | Lagos | `99c705e8-ce03-4471-893f-563de8902605` | Listed — normalized identity match |
| 189 | Lagos University of Science and Technology, Ikorodu | Lagos | `3697b5cc-8a6c-45a3-b624-4ceb4fc0d19c` | Listed — normalized identity match |
| 190 | Landmark University, Omu-Aran | Kwara | `5d3b8cc2-30ef-4236-ae21-64c911bb51e5` | Listed — normalized identity match |
| 191 | Lead City University, Ibadan | Oyo | `0aec6c11-1da2-478d-bcee-db9e59224f7f` | Listed — normalized identity match |
| 192 | Leadership University, Abuja | FCT Abuja | `a48c21eb-8810-49bc-80d9-626ee47364f9` | Listed — normalized identity match |
| 193 | Legacy University, Okija | Anambra | `676f2bc6-bddb-497f-95d6-8ebe736c4846` | Listed — normalized identity match |
| 194 | Lens University, Ilemona | Kwara | `2ef0b901-b6d1-4a3c-b75a-3aa45ed20099` | Listed — normalized identity match |
| 195 | Lighthouse University, Evbuobanosa | Edo | `8ac9ea94-bd45-4540-9d11-4820ee3c9efe` | Listed — normalized identity match |
| 196 | Lux Mundi University, Umuahia | Abia | `d7a4e40f-e03a-469f-9492-e3c6fa1f31b1` | Listed — normalized identity match |
| 197 | Madonna University, Okija | Anambra | `2776d912-7d5c-4ecc-9be0-a1a6dd80100f` | Listed — normalized identity match |
| 198 | Maduka University, Ekwegbe-Nsukka | Enugu | `66dee891-43d3-4087-af5d-4de12f2090e2` | Listed — normalized identity match |
| 199 | Maranatha University, Lekki | Lagos | `34d44710-1659-4059-9601-257699d65c57` | Listed — normalized identity match |
| 200 | Margaret Lawrence University, Galilee | Delta | `6e1eaa2e-be9a-47bb-bf67-182cb94453f6` | Listed — normalized identity match |
| 201 | Maria Assumpta University, Owerri | Imo | `98792dd8-02a1-426b-8609-4de4db35f0aa` | Listed — normalized identity match |
| 202 | Maryam Abacha American University of Nigeria, Kano | Kano | `95f3c869-bce7-45ec-8fef-86cfcd00c711` | Listed — normalized identity match |
| 203 | McPherson University, Seriki Sotayo | Ogun | `c08a53e7-02a1-450d-b13e-91cd5a0e93c3` | Listed — normalized identity match |
| 204 | Mercy Medical University, Iwara-Iwo | Osun | `ab23233b-94c1-4889-922c-043ce5f9d3ea` | Listed — normalized identity match |
| 205 | Mewar University, Masaka | Nasarawa | `546228d3-3782-4069-87d6-505ed150a4af` | Listed — normalized identity match |
| 206 | Michael & Cecilia Ibru University, Owhode | Delta | `3cea708a-a23e-4c79-97f4-c8d76d06c747` | Listed — normalized identity match |
| 207 | Michael Okpara University of Agriculture, Umudike | Abia | `901abd0c-66de-4484-91e0-b8e59f5ef390` | Listed — normalized identity match |
| 208 | Millennium Crest University, Ikare-Akoko | Ondo | `77d81302-d91b-4122-8e06-b9442bfbb874` | Listed — normalized identity match |
| 209 | Minaret University, Ikirun | Osun | `a70c3c39-7855-49b6-bfaf-e17888b81682` | Listed — normalized identity match |
| 210 | Miva Open University, Abuja | FCT Abuja | `925f4d53-794a-40ce-bac3-83c964227ff9` | Listed — normalized identity match |
| 211 | Modibbo Adama University, Yola | Adamawa | `b8be85c2-246a-4d42-b8af-0fff94ebf855` | Listed — normalized identity match |
| 212 | Monarch University, Iyesi-Ota | Ogun | `5c419401-5444-4561-8d8d-c2b5d15f65ec` | Listed — normalized identity match |
| 213 | Moshood Abiola University of Science and Technology, Abeokuta | Ogun | `5a4e6936-c3e7-4ce7-bc5d-57a0963beb10` | Listed — normalized identity match |
| 214 | Mountain Top University, Makogi | Ogun | `5c9dfac1-2856-4005-9574-dbdb83add2dc` | Listed — normalized identity match |
| 215 | Mudiame University, Irrua | Edo | `038f6812-2806-4235-afd7-4ca6722bb46c` | Listed — normalized identity match |
| 216 | Muhammad Kamalud-Deen University, Ilorin | Kwara | `11e2ffeb-c692-4ec1-a660-442dc0912c93` | Listed — normalized identity match |
| 217 | Nasarawa State University, Keffi | Nasarawa | `755f7619-22a3-4a12-8835-b1144659d045` | Listed — normalized identity match |
| 218 | National Open University of Nigeria, Abuja | FCT Abuja | `476cb995-d1e5-4349-9bf4-d8e5183ed562` | Listed — normalized identity match |
| 219 | National University of Science and Technology, Abuja | FCT Abuja | `f91f6c71-5959-438d-a8f9-861ac539b2e0` | Listed — normalized identity match |
| 220 | New City University, Ayetoro | Ogun | `3e0658c4-cc63-45ad-94d4-4837b59d2451` | Listed — normalized identity match |
| 221 | Newgate University, Minna | Niger | `c3184eb2-753c-410b-a15d-ebdbbbead0c4` | Listed — normalized identity match |
| 222 | Niger-Delta University, Yenagoa | Bayelsa | `7d4921a6-21a1-4f30-aefc-06b0dad43689` | Listed — normalized identity match |
| 223 | Nigeria Maritime University, Okerenkoko | Delta | `ae9483ac-6390-45c4-b7d8-19e8f79a2ac0` | Listed — normalized identity match |
| 224 | Nigerian Army University, Biu | Borno | `1fa2ec65-5268-4e0b-84f9-861aaa2c7a2e` | Listed — normalized identity match |
| 225 | Nigerian British University, Asa | Abia | `e3dd6ea1-a953-4228-9544-dea911967828` | Listed — normalized identity match |
| 226 | Nigerian Defence Academy, Kaduna | Kaduna | `44219824-5372-4dd6-928b-e36112d48637` | Listed — normalized identity match |
| 227 | Nigerian University of Technology and Management, Apapa | Lagos | `0f5d5559-c0de-43c8-ab25-6b2121580f3c` | Listed — normalized identity match |
| 228 | Nile University of Nigeria, Abuja | FCT Abuja | `d0af643c-0034-4850-b22f-12adb3973580` | Listed — normalized identity match |
| 229 | Nnamdi Azikiwe University, Awka | Anambra | `7ccd2609-7d44-4a2e-b5f4-05a1b57a64eb` | Listed — normalized identity match |
| 230 | North Eastern University, Gombe | Gombe | `3b00deff-c80c-49e4-a9f0-553a36045cef` | Listed — normalized identity match |
| 231 | Northwest University, Kano | Kano | `4977227d-6bad-44bc-abc1-69c68ee8b25a` | Listed — normalized identity match |
| 232 | Northwest University, Sokoto | Sokoto | `745d1a4d-30b0-4892-9ebe-ef468bb5fb17` | Listed — normalized identity match |
| 233 | Novena University, Ogume | Delta | `9af4baa5-9e51-4ccf-87a8-0c6b36fcdac0` | Listed — normalized identity match |
| 234 | Obafemi Awolowo University, Ile-Ife | Osun | `e09c2839-6eca-40d9-a42c-0a7e09a2f111` | Listed — normalized identity match |
| 235 | Obong University, Obong Ntak | Akwa Ibom | `e244dba0-aa52-407d-8b91-65625f7bec6d` | Listed — normalized identity match |
| 236 | Oduduwa University, Ipetumodu | Osun | `a1bd5182-e845-48e0-9dda-899c020f4f04` | Listed — normalized identity match |
| 237 | Ojaja University, Eiyenkorin | Kwara | `ae35db24-d450-4ebd-8119-01c08fc36470` | Listed — normalized identity match |
| 238 | Olabisi Onabanjo University, Ago-Iwoye | Ogun | `20dd6957-8290-4048-8c17-c83cfa6cabfb` | Listed — normalized identity match |
| 239 | Olusegun Agagu University of Science and Technology, Okitipupa | Ondo | `8ec98e6a-0e67-43c9-8b71-ae7a96c338c0` | Listed — normalized identity match |
| 240 | Omega University, Kaduna | Kaduna | `98fa2b87-4425-43fe-983a-a9974a7e20ac` | Listed — normalized identity match |
| 241 | Ondo State University of Medical Sciences | Ondo | `f79c4f1b-9bd6-4884-8929-d1c2f7808c94` | Listed — normalized identity match |
| 242 | Osun State University, Osogbo | Osun | `1bb9b5da-f58b-4ef1-9d82-3a96bab817ec` | Listed — normalized identity match |
| 243 | Owolabi University, Oke-Ila Orangun | Osun | `9240f4ce-5d3d-4dfb-a37f-eed7bb9e1283` | Listed — normalized identity match |
| 244 | PAMO University of Medical Sciences, Port-Harcourt | Rivers | `8fd5f901-89d7-4a88-afc8-37b2d8b9b4a6` | Listed — normalized identity match |
| 245 | Pan-Atlantic University, Lagos | Lagos | `ea3f1865-12aa-4de5-a8e8-727e5ca988b3` | Listed — normalized identity match |
| 246 | Paul University, Awka | Anambra | `be24b7f5-4c8b-46da-a9d6-6f9fabe7607b` | Listed — normalized identity match |
| 247 | Peaceland University, Enugu | Enugu | `20e729d7-33f7-4605-af4c-69e1a62cd30b` | Listed — normalized identity match |
| 248 | Pearl University, Calabar | Cross River | `4bc42629-ab2d-47b7-abcc-f3903284b45d` | Listed — normalized identity match |
| 249 | Peter University, Achina-Onneh | Anambra | `7cb4501b-2c20-466e-b62f-e49c2a29701f` | Listed — normalized identity match |
| 250 | Philomath University, Kuje | FCT Abuja | `71b6432b-7971-4ab8-94a3-846c997f981a` | Listed — normalized identity match |
| 251 | Phoenix University, Agwada | Nasarawa | `30b5d050-e344-4a8a-873b-78ea46b46bd3` | Listed — normalized identity match |
| 252 | Plateau State University, Bokkos | Plateau | `1de7f309-fb8a-4bde-8486-55839297d374` | Listed — normalized identity match |
| 253 | Precious Cornerstone University, Ibadan | Oyo | `b02ccd01-5820-47c9-80ad-7a619af5c0da` | Listed — normalized identity match |
| 254 | Prime University, Abuja | FCT Abuja | `a1fd2e96-d278-41e6-937f-d9571f83bef7` | Listed — normalized identity match |
| 255 | Prince Abubakar Audu University, Anyigba | Kogi | `f84f334d-f019-4582-85e6-1d08a2668527` | Listed — normalized identity match |
| 256 | Rayhaan University, Birnin Kebbi | Kebbi | `c400d0cb-1c86-4376-bf20-fe242577266a` | Listed — normalized identity match |
| 257 | Redeemer's University, Mowe | Ogun | `ba5c4087-1dff-45ef-865c-0408322e7adf` | Listed — normalized identity match |
| 258 | Regnum Medical University, Lagos | Lagos | `418c88b5-b347-4cce-a450-3b0d87b09011` | Listed — normalized identity match |
| 259 | Renaissance University, Enugu | Enugu | `eb88f57d-a63a-48e3-841b-578db33de716` | Listed — normalized identity match |
| 260 | Rhema University, Obeama-Asa | Rivers | `3adf210e-6d6d-437a-8023-bb9a3a66b184` | Listed — normalized identity match |
| 261 | Ritman University, Ikot Ekpene | Akwa Ibom | `6340b65e-a551-48c1-bffd-518a7d8b05f5` | Listed — normalized identity match |
| 262 | Rivers State University of Science & Technology, Port Harcourt | Rivers | `977facd4-4239-48cd-9b9b-cdb8aa67c9d2` | Listed — normalized identity match |
| 263 | Rv Fr. Moses Orshio Adasu University, Makurdi | Benue | `554bc31d-e2c0-46df-a6d8-9c0eb180150f` | Listed — normalized identity match |
| 264 | Sa'adu Zungur University, Gadau | Bauchi | `6813309d-b2fe-4dad-ae9e-231ac8343a97` | Listed — normalized identity match |
| 265 | Saisa University of Medical Sciences and Technology, Sokoto | Sokoto | `2ee98578-63f8-45c3-b213-0ea187ab89c7` | Listed — normalized identity match |
| 266 | Salem University, Lokoja | Kogi | `0766bab5-2454-43d2-99b9-12d703046e04` | Listed — normalized identity match |
| 267 | Sam Maris University, Supare | Ondo | `58e2617f-fcdf-4443-b20c-53f7ce1a2836` | Listed — normalized identity match |
| 268 | Sani Bello University, Kontagora | Niger | `baad4f6d-1bab-4c2a-b9a9-1d6ba975b3df` | Listed — normalized identity match |
| 269 | Shanahan University, Onitsha | Anambra | `7bd1f7fd-286a-4be0-9d5f-ab0a0eeb0afc` | Listed — normalized identity match |
| 270 | Shehu Shagari University of Education, Sokoto | Sokoto | `64daffa6-86d4-4251-a9f3-f5e70bb25204` | Listed — normalized identity match |
| 271 | Skyline University Nigeria, Kano | Kano | `1d8e57b4-0c77-4f6a-b958-f23319df9987` | Listed — normalized identity match |
| 272 | Sokoto State University, Sokoto | Sokoto | `b5c23a2e-90dc-41cc-bf23-6aa3ad690bbb` | Listed — normalized identity match |
| 273 | Southern Atlantic University, Uyo | Akwa Ibom | `fe5d34ab-5936-4e37-9448-2e784c00a714` | Listed — normalized identity match |
| 274 | Southwestern University, Oku Owa | Ogun | `da6bb2ec-4f72-48e6-9e79-e0a717a94433` | Listed — normalized identity match |
| 275 | Spiritan University, Nneochi | Abia | `d792735e-f3dd-41e4-a75c-c07f980a106c` | Listed — normalized identity match |
| 276 | Sports University, Idumuje-Ugboko | Delta | `f6b674f5-4eea-4ebb-ba61-68aa11f85324` | Listed — normalized identity match |
| 277 | Sule Lamido University, Kafin Hausa | Jigawa | `ee34d878-4c23-4d4e-a790-cc9c451e538c` | Listed — normalized identity match |
| 278 | Summit University, Offa | Kwara | `0425f0c7-6912-4ac4-95cb-b4069c369b3a` | Listed — normalized identity match |
| 279 | Tai Solarin Federal University of Education, Ijagun | Ogun | `4db43060-0aaa-4fd0-969e-a5b19e8968a4` | Listed — normalized identity match |
| 280 | Tansian University, Umunya | Anambra | `f1933f80-1ba9-4f86-ab7a-6156be220eab` | Listed — normalized identity match |
| 281 | Taraba State University of Tropical Agriculture, Science, Technology and Climate Action, Gembu | Taraba | `3cf8b74b-dbbc-47ec-8c06-7e344d54a3d2` | Listed — normalized identity match |
| 282 | Taraba State University, Jalingo | Taraba | `7e34dddc-c63b-46cd-9aee-013214175664` | Listed — normalized identity match |
| 283 | Tazkiyah University, Kaduna | Kaduna | `7e2ff72b-2752-4a2a-83f8-c8f7a2f3da4f` | Listed — normalized identity match |
| 284 | The Duke Medical University Calabar | Cross River | `1c7505a6-052b-4207-b97c-86e8c6914ccf` | Listed — normalized identity match |
| 285 | The Nigeria Police Academy, Wudil | Kano | `082f69d9-e590-4a3f-b9ba-bc50d19d9b10` | Listed — normalized identity match |
| 286 | Thomas Adewumi University, Oko-Irese | Kwara | `fcb490d2-6beb-4863-b4ec-d0a5f5ca0691` | Listed — normalized identity match |
| 287 | Tonnie Iredia University of Communication, Benin City | Edo | `10f0c0eb-1ccd-4c4b-ae6f-aed5ed66ba5e` | Listed — normalized identity match |
| 288 | Topfaith University, Mkpatak | Akwa Ibom | `f8af2b1a-1b64-4c75-84df-9c2dca2536d6` | Listed — normalized identity match |
| 289 | Transatlantic University of Medicine and Health Sciences, Umuchukwu | Anambra | `54004a99-4a8b-490c-8098-7d4bc006dda1` | Listed — normalized identity match |
| 290 | Trinity University, Laloko | Ogun | `554745b6-0842-4403-82e0-eb3529d71841` | Listed — normalized identity match |
| 291 | Umaru Musa Yar'Adua University, Katsina | Katsina | `f508df34-ae52-43aa-935a-5ef9c0148a74` | Listed — normalized identity match |
| 292 | Ummah University of Nigeria, Abuja | FCT Abuja | `a5f730ef-565d-4468-8171-896fda9045ae` | Listed — normalized identity match |
| 293 | Unique Open University, Ojo | Lagos | `b86dc085-2fb8-4764-a2de-349a8229bf91` | Listed — normalized identity match |
| 294 | University of Abuja, Abuja | FCT Abuja | `9b164365-d366-4ff7-a432-b6713a89cea0` | Listed — normalized identity match |
| 295 | University of Africa, Toru-Orua | Bayelsa | `c86d0faf-7f6e-4d9b-aa1a-047da30bccfe` | Listed — normalized identity match |
| 296 | University of Agriculture and Environmental Sciences, Umuagwo | Imo | `160dba7e-ca20-4053-8546-0a3552481ef8` | Listed — normalized identity match |
| 297 | University of Benin, Benin City | Edo | `991f3a9b-3a75-4387-ae85-b549fa9f518d` | Listed — normalized identity match |
| 298 | University of Calabar | Cross River | `1e7e9cdd-b6aa-42d1-b9fc-76f8d6a55ddc` | Duplicate candidate — same NUC identity as #299; do not merge without dependency review |
| 299 | University of Calabar, Calabar | Cross River | `255e4ba4-b75f-48b1-8ed1-00a7fcb8a967` | NUC canonical-name candidate — University of Calabar, Calabar; paired with #298 |
| 300 | University of Delta, Agbor | Delta | `9b014839-ce1d-4bc2-a684-f8430afeec37` | Listed — normalized identity match |
| 301 | University of Fortune, Igbotako | Ondo | `b54bc286-df27-44d1-b3a7-5d9381daab19` | Listed — normalized identity match |
| 302 | University of Ibadan, Ibadan | Oyo | `95973447-9429-487b-90e8-39567bf85490` | Listed — normalized identity match |
| 303 | University of Ilesa | Osun | `f7cf93ab-6b14-4e0b-a423-1b5562593ba4` | Listed — normalized identity match |
| 304 | University of Ilorin, Ilorin | Kwara | `d6af6d54-32d4-495d-aa6e-dc35ac417801` | Listed — normalized identity match |
| 305 | University of Innovation, Science & Technology, Omuma | Imo | `31a1b929-10c2-4141-ad92-22a23763727e` | Listed — normalized identity match |
| 306 | University of Jos, Jos | Plateau | `62812323-3f89-41b9-a689-f64ce20f69d2` | Listed — normalized identity match |
| 307 | University of Lagos, Lagos | Lagos | `dfccdb64-8d35-4e99-b68a-56a2129a6448` | Listed — normalized identity match |
| 308 | University of Maiduguri, Maiduguri | Borno | `5b81502d-6122-43a3-afa3-dd384a4b4573` | Listed — normalized identity match |
| 309 | University of Maritime Studies, Oron | Akwa Ibom | `ba387435-c20f-47b8-9085-d3a5f6ca5760` | Listed — normalized identity match |
| 310 | University of Mkar, Mkar | Benue | `aee34a32-eaf4-4647-b588-9da772edc5ff` | Listed — normalized identity match |
| 311 | University of Nigeria, Nsukka | Enugu | `0277cfbf-97c2-4f56-aecf-843ea1b51df6` | Listed — normalized identity match |
| 312 | University of Offa, Offa | Kwara | `d1f7de2d-bec3-4d7f-abd1-feafe5bbb0c4` | Listed — normalized identity match |
| 313 | University of Port-Harcourt, Port-Harcourt | Rivers | `829cf2d2-f242-479c-a63f-47aabf161cef` | Listed — normalized identity match |
| 314 | University of Science and Technology, Ozoro | Delta | `e5604fd5-779b-4e03-b877-c05dd452e473` | Listed — normalized identity match |
| 315 | University of Uyo, Uyo | Akwa Ibom | `52f12019-b0a8-4bad-ad7b-768d6ac6e099` | Listed — normalized identity match |
| 316 | University on the Niger, Umunya | Anambra | `6c0ef289-8417-4c58-9fc7-66cc71809d11` | Listed — normalized identity match |
| 317 | Usmanu Danfodiyo University, Sokoto | Sokoto | `ed86c762-30f2-43ec-84bb-e0f7d5ad09f4` | Listed — normalized identity match |
| 318 | Venite University, Iloro-Ekiti | Ekiti | `34d66245-e789-4db3-9153-c7fb088c5f2e` | Listed — normalized identity match |
| 319 | Veritas University, Abuja | FCT Abuja | `c382e2a9-4f83-44e0-8319-15dd08d42639` | Listed — normalized identity match |
| 320 | Vision University, Ikogbo | Ogun | `8f9d62ab-6a71-4ece-95ca-43122dfb57a0` | Listed — normalized identity match |
| 321 | Wellspring University, Evbuobanosa | Edo | `ba73e6c9-9678-4939-a53a-e70a53b050e9` | Listed — normalized identity match |
| 322 | Wesley University of Science & Technology | Ondo | `7b1f15ab-f132-476d-843a-71ec40bccac7` | Listed — normalized identity match |
| 323 | West Midland Open University, Ibadan | Oyo | `5e42d427-262a-4987-9f13-11be184378b8` | Listed — normalized identity match |
| 324 | Western Delta University, Oghara | Delta | `9a61d283-823d-4c93-83aa-17d4898e7339` | Listed — normalized identity match |
| 325 | Westland University, Iwo | Osun | `a6cc4eb1-8fcf-463e-bdf0-73b8dafda9ae` | Listed — normalized identity match |
| 326 | Wigwe University, Isiokpo | Rivers | `220a2e1c-a12b-43f4-ba63-4014a2a0dabc` | Listed — normalized identity match |
| 327 | Yobe State University, Damaturu | Yobe | `d7044388-bca4-4038-a607-210c16d63a20` | Listed — normalized identity match |
| 328 | Yusuf Maitama Sule Federal University of Education, Kano | Kano | `e9f5b39c-0161-4a00-b530-6677c7650a95` | Listed — normalized identity match |
| 329 | Zamfara State University, Talata-Mafara | Zamfara | `68b7ad51-784b-46bc-85fa-0a265246713c` | Listed — normalized identity match |

## 4. Confirmed duplicate/alias case: University of Calabar

| Inventory row | Display name | UUID |
|---:|---|---|
| 298 | University of Calabar | `1e7e9cdd-b6aa-42d1-b9fc-76f8d6a55ddc` |
| 299 | University of Calabar, Calabar | `255e4ba4-b75f-48b1-8ed1-00a7fcb8a967` |

The NUC nationwide table contains one entry: **University of Calabar, Calabar**, Cross River State, Federal ownership, established 1975. Row 299 is the better display-name match to the NUC canonical label. Row 298 has the institutional website URL populated (`https://www.unical.edu.ng/`), while row 299 does not. Preserve the website and inspect all dependencies before deciding which UUID survives.

**Required remediation sequence:**
1. Query all foreign keys and application references for both UUIDs.
2. Compare linked programmes, admissions, applications, student favourites, saved institutions, analytics, content, and integration references.
3. Select a canonical UUID based on live usage and data completeness—not display-name preference alone.
4. Create a reversible alias/redirect mapping from the non-canonical UUID.
5. Prepare a reviewed migration and obtain explicit approval before any production write.

## 5. NUC directory internal inconsistencies and name variants

| NUC directory observation | EduReach inventory position | QA treatment |
|---|---|---|
| Nationwide table lists **Gombe State University, Gombe**. Geographic-zone list instead includes **Gombe State University of Science and Technology, Kumo**. | Inventory contains Gombe State University, Gombe. | Treat as a NUC source inconsistency requiring direct NUC clarification. Do not silently rename or add a second Gombe institution. |
| Geographic-zone list includes **Pen Resource University, Gombe**, but it is absent from the main nationwide table. | No Pen Resource University row in the 329-row inventory. | Pending NUC confirmation whether the zone-list entry is a valid current listing, a stale item, or a directory error. Do not add based only on the zone list. |
| NUC nationwide table spells the Bamidele Olumilua institution as **Bamidele Olumulia University of Education Science and Technology**. | Inventory uses **Bamidele Olumilua University of Education Science and Technology, Ikere**. | Preserve the inventory's name pending confirmation; record the NUC spelling difference as a source typo/name variant. |
| NUC table uses **Nigeria Maritime University Okerenkoko**. | Inventory uses **Nigeria Maritime University, Okerenkoko**. | Punctuation/word-order variant; same identity candidate. |
| NUC table uses **University of Port-Harcourt, Port-Harcourt**. | Inventory uses the same hyphenated display name. | Keep the existing form until an official canonical institutional style is confirmed. |
| NUC table records Transatlantic University of Medicine and Health Sciences in state **Anambara**. | Inventory state is **Anambra**. | Treat as NUC spelling error; inventory state appears to be the correct state label. |
| NUC page headline ownership summary reports 69 state universities, while an NUC news item has described a 70th state-owned university; page zone list also differs from its nationwide table. | Inventory schema has no federal/state/private ownership column. | Do not infer ownership totals or populate ownership from the inventory's generic type field. Track NUC source inconsistency separately. |

## 6. Data-model gaps

The inventory schema currently stores `institutionType: university` for all 329 rows. It does **not** store a separate NUC ownership classification (Federal / State / Private), NUC directory identifier, licence/status evidence, canonical-name field, or alias list. This prevents EduReach from reliably distinguishing institution category from ownership and makes future NUC synchronization harder.

Recommended additive fields for a future reviewed schema migration:
- `nucCanonicalName` — exact current NUC display name.
- `nucOwnership` — Federal, State, Private, or Unresolved.
- `nucDirectoryStatus` — Listed, Not listed, Conflicting source, or Pending.
- `nameAliases[]` — verified former names and spelling variants.
- `nucLastVerifiedAt` and `nucSourceUrl` — evidence provenance.
- `identityReviewStatus` — Pending, Confirmed, Alias, Duplicate candidate, or Disputed.

Do not conflate NUC institution listing with approval/accreditation of individual programmes. Programme-level evidence and JAMB IBASS subject combinations remain separate QA workstreams.

## 7. Recommended disposition

| Issue | Proposed disposition | Production action now? |
|---|---|---|
| University of Calabar duplicate UUID pair | Open a data-dependency investigation and prepare a reversible merge/alias plan. | No |
| Gombe State University vs Gombe State University of Science and Technology naming discrepancy | Request NUC clarification and check official state legislation/university sources. | No |
| Pen Resource University in zone list only | Keep out of inventory additions until it appears in the NUC nationwide table or is confirmed by NUC in writing. | No |
| Bamidele Olumilua/Olumulia spelling | Retain both source spellings in evidence; adopt canonical name only after confirmation. | No |
| Missing ownership and canonical-name metadata | Design additive schema proposal and migration separately. | No |

## 8. Source evidence

1. NUC Nigerian University System directory (live; nationwide table, ownership totals, institution profiles, and geopolitical-zone lists): https://enuc.nuc.edu.ng/nus
2. NUC federal universities directory: https://www.nuc.edu.ng/nigerian-univerisities/federal-univeristies/
3. NUC Bulletin, 30 June 2025, approved universities list: https://www.nuc.edu.ng/wp-content/uploads/2025/07/Bulletin-30th-June-2025.pdf

## 9. QA conclusion

**Aggregate identity reconciliation: provisionally reconciled at 328 distinct institutions**, subject to resolving the Calabar duplicate UUID pair and NUC's internal Gombe/Pen Resource inconsistencies. The current inventory is not yet production-ready for a destructive cleanup. The next work should be dependency analysis for the Calabar pair, followed by ownership metadata and programme-level verification. No production database changes have been made.