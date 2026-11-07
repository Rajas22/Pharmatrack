// Adds pictures to the 108 built-in medicines (D0001-D0114) that had no image.
// The links are real product pictures taken from the "Image URL" column of
// Medicine_Details.csv: each medicine got the picture of a branded product with
// the same ingredient, same dosage form and (where possible) the same strength.
//
// Usage (stop the server first):
//   node add-remaining-images.js          -> adds the pictures
//   node add-remaining-images.js --dry    -> only shows what it would do
//
// Only drugs that have NO picture yet are touched; existing pictures, IDs and
// all other fields are kept. A backup is saved as data/drugs.json.bak
// Medicines without a match (D0066, D0076, D0090, D0091, D0092, D0093) keep
// showing the dosage-form drawing.

const fs = require('fs');
const path = require('path');

const IMAGES = [
 {
  "drugId": "D0001",
  "name": "Paracetamol",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/yyl9iaofkfybymnakpc4.jpg"
 },
 {
  "drugId": "D0002",
  "name": "Paracetamol",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/0e27333d921b4d4ea4a749883b23da93.jpg"
 },
 {
  "drugId": "D0003",
  "name": "Paracetamol",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/vm5ksd60glyblstpvhnk.jpg"
 },
 {
  "drugId": "D0004",
  "name": "Ibuprofen",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/yssbye7myd6dgld7wn2n.jpg"
 },
 {
  "drugId": "D0005",
  "name": "Diclofenac",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/efc696a4eaf34c5aaaed2f205d1d283d.jpg"
 },
 {
  "drugId": "D0006",
  "name": "Diclofenac",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/d140a943f24444c29f0bc305f2af49c1.jpg"
 },
 {
  "drugId": "D0007",
  "name": "Naproxen",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/eirevadqcgieqpmklyqn.jpg"
 },
 {
  "drugId": "D0008",
  "name": "Aceclofenac",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/96c5d610632240caa6001ffc9bcfd344.jpg"
 },
 {
  "drugId": "D0009",
  "name": "Mefenamic Acid",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/bwurbf5qajuadbbw7ys8.jpg"
 },
 {
  "drugId": "D0010",
  "name": "Ketorolac",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/zxvidqygvuo4xmifpmz7.jpg"
 },
 {
  "drugId": "D0011",
  "name": "Aspirin",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/reowbvajejs6awykdplk.jpg"
 },
 {
  "drugId": "D0012",
  "name": "Amoxicillin",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/ulkzrqbb8a7tnxewwlsn.jpg"
 },
 {
  "drugId": "D0013",
  "name": "Amoxicillin",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/h7jh57fg1dccv9byjddt.jpg"
 },
 {
  "drugId": "D0014",
  "name": "Amoxicillin + Clavulanic Acid",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/aa55bf8ba8ab42868039f4cc2edcb816.jpg"
 },
 {
  "drugId": "D0015",
  "name": "Azithromycin",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/e156e9f3da414f7aae89f49575c44308.jpg"
 },
 {
  "drugId": "D0016",
  "name": "Azithromycin",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/jxeqkezctugqpdvbhfme.png"
 },
 {
  "drugId": "D0017",
  "name": "Clarithromycin",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/o4tmdssxuxau4bclnfew.jpg"
 },
 {
  "drugId": "D0018",
  "name": "Ciprofloxacin",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/x4go5dnlumyxamb2plpd.jpg"
 },
 {
  "drugId": "D0019",
  "name": "Levofloxacin",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/neiibi92buqpybxega0z.jpg"
 },
 {
  "drugId": "D0020",
  "name": "Ofloxacin",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cf2dac55843c401c810a30f0f06b0037.jpg"
 },
 {
  "drugId": "D0021",
  "name": "Cefixime",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/utlmf2w2w9v9jn9bp4hp.jpg"
 },
 {
  "drugId": "D0022",
  "name": "Cefuroxime",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/phtlofbn4evzbfjxogkr.jpg"
 },
 {
  "drugId": "D0023",
  "name": "Cephalexin",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/muy6puzksnzzr1nv6spv.jpg"
 },
 {
  "drugId": "D0024",
  "name": "Doxycycline",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/3246b20ea5c140cd9896ff3d85306406.jpg"
 },
 {
  "drugId": "D0025",
  "name": "Metronidazole",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/d4dd6a05dc7f4b3c91fd8e7d7a6a5ac3.jpg"
 },
 {
  "drugId": "D0026",
  "name": "Cotrimoxazole",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/617203680ba64c1f99482a8a6d8a55e5.jpg"
 },
 {
  "drugId": "D0027",
  "name": "Linezolid",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/w1xvagkclpp6wmnqlyb8.jpg"
 },
 {
  "drugId": "D0028",
  "name": "Nitrofurantoin",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/6aa00496f5514b7c84354a2781300b85.jpg"
 },
 {
  "drugId": "D0029",
  "name": "Mupirocin",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/ede5fad2eae541e48385c02f79f074d3.jpg"
 },
 {
  "drugId": "D0030",
  "name": "Metformin",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/ubpfkhgo19eqmml9nq63.jpg"
 },
 {
  "drugId": "D0031",
  "name": "Metformin",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/xnwisaure1lz31murgmd.jpg"
 },
 {
  "drugId": "D0032",
  "name": "Glimepiride",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/3652bf3f03f74d959b9c2ca392b1050c.jpg"
 },
 {
  "drugId": "D0033",
  "name": "Gliclazide",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/r9uzuaa5d3rod0yqdlz9.jpg"
 },
 {
  "drugId": "D0034",
  "name": "Sitagliptin",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/tylw7gc7xhvlqetdlvji.jpg"
 },
 {
  "drugId": "D0035",
  "name": "Vildagliptin",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/dm7odmnzmahpiatogoo8.jpg"
 },
 {
  "drugId": "D0036",
  "name": "Pioglitazone",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/reetwniluyr8udswbt9z.jpg"
 },
 {
  "drugId": "D0037",
  "name": "Empagliflozin",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/4f108e3cd95f4a94bc7a1ae8fb6c6f63.jpg"
 },
 {
  "drugId": "D0038",
  "name": "Insulin Glargine",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cafba521ccf34480bc97b055dac9e924.jpg"
 },
 {
  "drugId": "D0039",
  "name": "Insulin Regular",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/sf3zreaixjuqyg3wzpgc.jpg"
 },
 {
  "drugId": "D0040",
  "name": "Amlodipine",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/kz7zlovqtpenopjx2pxz.jpg"
 },
 {
  "drugId": "D0041",
  "name": "Amlodipine",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/s5dkgt9qoly5ofhgfmh1.jpg"
 },
 {
  "drugId": "D0042",
  "name": "Losartan",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/7ece4069ac0e4cbeb82d5d37223e62c0.jpg"
 },
 {
  "drugId": "D0043",
  "name": "Telmisartan",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/fju3xxjhfkjbkj8lnhw4.jpg"
 },
 {
  "drugId": "D0044",
  "name": "Valsartan",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/mgei3enzn67rsbl069y9.jpg"
 },
 {
  "drugId": "D0045",
  "name": "Enalapril",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/f330919b2ebc4417875e25ebf85d943a.jpg"
 },
 {
  "drugId": "D0046",
  "name": "Ramipril",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/nw7ezx27f0owoacua3cb.jpg"
 },
 {
  "drugId": "D0047",
  "name": "Atenolol",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/po2tdwe25oqilkb6ytmk.jpg"
 },
 {
  "drugId": "D0048",
  "name": "Metoprolol",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/agpifk2dcbj8kdqfwnl8.jpg"
 },
 {
  "drugId": "D0049",
  "name": "Hydrochlorothiazide",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/blnbbdc1tzwz82p4a71y.jpg"
 },
 {
  "drugId": "D0050",
  "name": "Furosemide",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/pmvxhtdtxl1vjonvjdlx.jpg"
 },
 {
  "drugId": "D0051",
  "name": "Atorvastatin",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/h9n3iv60ihxsmqwwtwhl.jpg"
 },
 {
  "drugId": "D0052",
  "name": "Atorvastatin",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/u007xpb3gaadlh76dxb2.jpg"
 },
 {
  "drugId": "D0053",
  "name": "Rosuvastatin",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/gu3uwhetiqwwchasqrbb.jpg"
 },
 {
  "drugId": "D0054",
  "name": "Clopidogrel",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/ekbzfu3xgvypj0eoqbav.jpg"
 },
 {
  "drugId": "D0055",
  "name": "Warfarin",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/1001e3ba0dc04adaa918f5a190b05941.jpg"
 },
 {
  "drugId": "D0056",
  "name": "Isosorbide Mononitrate",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/a4a9d8ea834843fc82e32dd88f630294.jpg"
 },
 {
  "drugId": "D0057",
  "name": "Digoxin",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/udpaqhpxf1vqc48mfnno.jpg"
 },
 {
  "drugId": "D0058",
  "name": "Cetirizine",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/o18ildbo6przcq3edopl.jpg"
 },
 {
  "drugId": "D0059",
  "name": "Levocetirizine",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/vwk2ixq62wfjsclmsr2f.jpg"
 },
 {
  "drugId": "D0060",
  "name": "Loratadine",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/20096245ceb342f29f11029c12fadd8a.jpg"
 },
 {
  "drugId": "D0061",
  "name": "Fexofenadine",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/izapz6cvtw4iam09uooe.jpg"
 },
 {
  "drugId": "D0062",
  "name": "Montelukast",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/3caadc74999e4863baa59ffa8a4e9af9.jpg"
 },
 {
  "drugId": "D0063",
  "name": "Salbutamol",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/9117d15a82fc4d41889e083e295d7de9.jpg"
 },
 {
  "drugId": "D0064",
  "name": "Budesonide",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/zcwgy0m7fzspxi2kucqd.jpg"
 },
 {
  "drugId": "D0065",
  "name": "Ambroxol",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/e3tv7jcvnbspycgqdhxd.jpg"
 },
 {
  "drugId": "D0067",
  "name": "Omeprazole",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/55dfce8bc94541e3bd2a06e0675af3b7.jpg"
 },
 {
  "drugId": "D0068",
  "name": "Pantoprazole",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/xl52f1f5icvyt3nh3qvx.jpg"
 },
 {
  "drugId": "D0069",
  "name": "Rabeprazole",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/huvrtkq35xfmiueto7po.jpg"
 },
 {
  "drugId": "D0070",
  "name": "Esomeprazole",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/mjyzork7gd8d5j0htqgh.jpg"
 },
 {
  "drugId": "D0071",
  "name": "Famotidine",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/ondg3zkqrrwogrjtb8dn.jpg"
 },
 {
  "drugId": "D0072",
  "name": "Domperidone",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/226fbefe1e6b48a993c7d82edbb9a402.jpg"
 },
 {
  "drugId": "D0073",
  "name": "Ondansetron",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/frthp3ucp4fxeu0yqdpn.jpg"
 },
 {
  "drugId": "D0074",
  "name": "Loperamide",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/gtyaeiwpllscanq6ieyo.jpg"
 },
 {
  "drugId": "D0075",
  "name": "Lactulose",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/vkx8qgblclksnsxjdjrn.jpg"
 },
 {
  "drugId": "D0077",
  "name": "Fluconazole",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/mjis6y9qxyyiv9mkc1wn.jpg"
 },
 {
  "drugId": "D0078",
  "name": "Itraconazole",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/oqbfvmq2ijyv1iwfrrf1.png"
 },
 {
  "drugId": "D0079",
  "name": "Terbinafine",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/aict0d9dejpskyv0lvvu.jpg"
 },
 {
  "drugId": "D0080",
  "name": "Clotrimazole",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/vsrreacjeqj34b1q1g6e.jpg"
 },
 {
  "drugId": "D0081",
  "name": "Acyclovir",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/xya7kntakqbfamjrpu70.jpg"
 },
 {
  "drugId": "D0082",
  "name": "Valacyclovir",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/ae70756e3a97484e977a80164c5a7bda.jpg"
 },
 {
  "drugId": "D0083",
  "name": "Oseltamivir",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/nidx2xrtyghdz2r7xzto.jpg"
 },
 {
  "drugId": "D0084",
  "name": "Albendazole",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/39ae18701cde4b46ba379eba88322b69.jpg"
 },
 {
  "drugId": "D0085",
  "name": "Ivermectin",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/lhccy4rlrpk1orywqpgs.jpg"
 },
 {
  "drugId": "D0086",
  "name": "Vitamin D3",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/29ff7019cb4644ea91d0cd4551e78328.jpg"
 },
 {
  "drugId": "D0087",
  "name": "Vitamin B12 (Methylcobalamin)",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/ae6ap7qa91chpxmo0pgp.jpg"
 },
 {
  "drugId": "D0088",
  "name": "Vitamin C",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/ip1dsco8i5rcjujek0vm.jpg"
 },
 {
  "drugId": "D0089",
  "name": "Folic Acid",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/gqcgdtjtkhnze1rv5yqy.jpg"
 },
 {
  "drugId": "D0094",
  "name": "Sertraline",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/2a22db7872d44ae3b0d0eae90abeeaaf.jpg"
 },
 {
  "drugId": "D0095",
  "name": "Escitalopram",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/gge11lgcnamelty696wq.jpg"
 },
 {
  "drugId": "D0096",
  "name": "Amitriptyline",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/ffddf4528375471cb02d465b546f4697.jpg"
 },
 {
  "drugId": "D0097",
  "name": "Gabapentin",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/anfc4x8hrxuuspoqdy7l.jpg"
 },
 {
  "drugId": "D0098",
  "name": "Pregabalin",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/py8g6purl6bfhur16lnn.jpg"
 },
 {
  "drugId": "D0099",
  "name": "Levetiracetam",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/juxjw1s84zvde9m60p2g.jpg"
 },
 {
  "drugId": "D0100",
  "name": "Carbamazepine",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/hvbc3i5kikhavpf1zxci.jpg"
 },
 {
  "drugId": "D0101",
  "name": "Sumatriptan",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/so7sxp1zgkrpddaeaqto.jpg"
 },
 {
  "drugId": "D0102",
  "name": "Levothyroxine",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/ce4f112495d041c892e8cfa33a4f4b4b.jpg"
 },
 {
  "drugId": "D0103",
  "name": "Levothyroxine",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/s3qxdwi2kgzpk9qox1a6.jpg"
 },
 {
  "drugId": "D0104",
  "name": "Prednisolone",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/wq7ax30uaf5rhhgvv2l5.jpg"
 },
 {
  "drugId": "D0105",
  "name": "Dexamethasone",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/rnqarufc3q9bjlnkntgb.jpg"
 },
 {
  "drugId": "D0106",
  "name": "Methylprednisolone",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/6d9e937865294b75944d985403d9d222.jpg"
 },
 {
  "drugId": "D0107",
  "name": "Betamethasone",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/1fd76962854b408fbedaebefd3c46b4e.jpg"
 },
 {
  "drugId": "D0108",
  "name": "Hydrocortisone",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/qwtl71zmblkpwqgmfgiw.jpg"
 },
 {
  "drugId": "D0109",
  "name": "Povidone-Iodine",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/nvyctbshzt9vapnpftii.jpg"
 },
 {
  "drugId": "D0110",
  "name": "Allopurinol",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/cropped/btkotdtrxfolg7dtwxgc.jpg"
 },
 {
  "drugId": "D0111",
  "name": "Tamsulosin",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/fc7f8319ec354e25ba028f44f99381e7.jpg"
 },
 {
  "drugId": "D0112",
  "name": "Finasteride",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/0b7ef8d45610409f80e990eed5ed06cc.jpg"
 },
 {
  "drugId": "D0113",
  "name": "Alendronate",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/gbtfbiwnwz8kdg4nmcce.jpg"
 },
 {
  "drugId": "D0114",
  "name": "Tranexamic Acid",
  "image": "https://onemg.gumlet.io/l_watermark_346,w_480,h_480/a_ignore,w_480,h_480,c_fit,q_auto,f_auto/1b63e6a4915a4627a05d0de5dde718c0.jpg"
 }
];

const DRUGS_FILE = path.join(__dirname, 'data', 'drugs.json');
const dry = process.argv.includes('--dry');

if (!fs.existsSync(DRUGS_FILE)) {
  console.error('data/drugs.json not found.');
  process.exit(1);
}

const drugs = JSON.parse(fs.readFileSync(DRUGS_FILE, 'utf8'));
const byId = new Map(IMAGES.map((x) => [x.drugId, x]));
let added = 0, kept = 0, skipped = 0;
for (const d of drugs) {
  const hit = byId.get(d.drugId);
  if (d.image) { if (hit) kept++; continue; }
  if (hit && hit.name === d.name) { d.image = hit.image; added++; } else if (hit) skipped++;
}

console.log('Pictures added:                  ' + added);
console.log('Already had a picture (kept):    ' + kept);
console.log('Skipped (drug changed):          ' + skipped);
console.log('Still without picture:           ' + drugs.filter((d) => !d.image).length);

if (dry) { console.log('\nDry run only, nothing was written.'); process.exit(0); }

fs.copyFileSync(DRUGS_FILE, DRUGS_FILE + '.bak');
fs.writeFileSync(DRUGS_FILE + '.tmp', JSON.stringify(drugs, null, 2));
fs.renameSync(DRUGS_FILE + '.tmp', DRUGS_FILE);
console.log('\nDone. Start the server again: npm start');
