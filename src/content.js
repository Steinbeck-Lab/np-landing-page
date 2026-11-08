export const categories = [
  "Databases",
  "Research tools",
  "Developer resources",
  "Chemical AI",
];

export const initialSettings = {
  eyebrow: "OPEN SOFTWARE FOR CHEMISTRY AND NATURAL PRODUCTS.",
  title: "Natural Products Online",
  introduction:
    "Explore open databases, research tools, and chemical AI for natural products. An interconnected ecosystem, built for the scientific community.",
  aboutTitle: "Open by nature.\nCollaborative by design.",
  aboutText:
    "Natural Products Online brings together resources developed and maintained by the Steinbeck Group at Friedrich Schiller University Jena. We connect natural products research with open data and open-source cheminformatics.",
  contactName: "Steinbeck Group",
  contactEmail: "christoph.steinbeck@uni-jena.de",
  address:
    "Institute for Inorganic and Analytical Chemistry\nFriedrich Schiller University Jena\nRosalind-Franklin-Straße 5, 07743 Jena, Germany",
  githubUrl: "https://github.com/Steinbeck-Lab",
  groupUrl: "https://cheminf.uni-jena.de/",
  privacyUrl: "",
  legalUrl: "",
};

export const initialResources = [
  {
    slug: "coconut",
    name: "COCONUT",
    category: "Databases",
    description:
      "The COlleCtion of Open Natural prodUcTs: deposit, curate and reuse natural product data.",
    url: "https://coconut.naturalproducts.net/",
    featured: true,
    source:
      "https://naturalproducts.net/wp-content/uploads/2024/08/logo-768x166.png",
  },
  {
    slug: "lotus",
    name: "LOTUS",
    category: "Databases",
    description:
      "Discover connections between natural products, the organisms that produce them, and the scientific literature.",
    url: "https://lotus.naturalproducts.net/",
    featured: true,
    source:
      "https://naturalproducts.net/wp-content/uploads/2021/05/coconut_logo-768x247.png",
  },
  {
    slug: "decimer",
    name: "DECIMER",
    category: "Chemical AI",
    description:
      "Extract chemical structures from PDFs and images, and turn them into SMILES.",
    url: "https://decimer.ai/",
    featured: true,
    source:
      "https://naturalproducts.net/wp-content/uploads/2021/06/DECIMER-1-1024x336.png",
  },
  {
    slug: "watermelon",
    name: "Watermelon",
    category: "Databases",
    description:
      "Explore the Watermelon resource in the Natural Products Online ecosystem.",
    url: "https://watermelon.naturalproducts.net/",
    source:
      "https://naturalproducts.net/wp-content/uploads/2021/06/zWaterMelonText-768x259.png",
  },
  {
    slug: "sugar",
    name: "SUGAR",
    category: "Research tools",
    description:
      "Explore tools for identifying and working with sugar moieties in chemical structures.",
    url: "https://sugar.naturalproducts.net/",
    source:
      "https://naturalproducts.net/wp-content/uploads/2020/07/Sgar_web-1024x336-1-768x252.png",
  },
  {
    slug: "mortar",
    name: "MORTAR",
    category: "Research tools",
    description:
      "The MOlecule fRagmenTAtion fRamework: in silico fragmentation on the desktop.",
    url: "https://felixbaensch.github.io/MORTAR/",
    source:
      "https://naturalproducts.net/wp-content/uploads/2025/05/Mortar-1-768x163.png",
  },
  {
    slug: "naples",
    name: "NaPLeS",
    category: "Research tools",
    description:
      "Explore natural product likeness through the NaPLeS web resource.",
    url: "https://naples.naturalproducts.net/",
    source:
      "https://naturalproducts.net/wp-content/uploads/2020/07/NaPLes-768x252.png",
  },
  {
    slug: "api",
    name: "Cheminformatics API",
    category: "Developer resources",
    description:
      "Find documentation for integrating cheminformatics services into your own research workflows.",
    url: "https://docs.api.naturalproducts.net/",
    source:
      "https://naturalproducts.net/wp-content/uploads/2025/04/Cheminf_API-300x147.png",
  },
  {
    slug: "chemaudit",
    name: "ChemAudit",
    category: "Research tools",
    description:
      "Validate, standardize and score chemical structures before they feed a model or a database.",
    url: "https://chemaudit.naturalproducts.net/",
    source:
      "https://naturalproducts.net/wp-content/uploads/2026/02/Banner_logo-2048x757.png",
  },
  {
    slug: "app",
    name: "Cheminformatics App",
    category: "Research tools",
    description:
      "CDK, RDKit and Open Babel, unified behind one REST API and web app.",
    url: "https://app.naturalproducts.net/",
    source:
      "https://naturalproducts.net/wp-content/uploads/2025/04/Cheminf_APP-300x147.png",
  },
  {
    slug: "marcus",
    name: "MARCUS",
    category: "Chemical AI",
    description:
      "Discover MARCUS, part of the DECIMER ecosystem of chemical AI resources.",
    url: "https://marcus.decimer.ai/",
    source:
      "https://naturalproducts.net/wp-content/uploads/2026/06/Picture1-2048x432.png",
  },
  {
    slug: "nmrxiv",
    name: "nmrXiv",
    category: "Databases",
    description:
      "Discover, share, and reuse open NMR data, spectra, and chemical structures organized by publication and research study.",
    url: "https://nmrxiv.org/",
    source: "https://nmrxiv.org/img/logo.svg",
  },
];

// Added after launch via the "extra resources" migration (safe to re-run:
// existing entries are skipped). Logos: public/logos/<slug>.webp.
export const extraResources = [
  {
    slug: "orthonym",
    name: "Orthonym",
    category: "Research tools",
    description:
      "Deterministic structure-to-IUPAC names, each checked by an OPSIN round trip.",
    url: "https://orthonym.decimer.ai/",
  },
  {
    slug: "sherlock",
    name: "Sherlock",
    category: "Research tools",
    description:
      "Computer-assisted structure elucidation, from NMR spectra to structures.",
    url: "https://github.com/Steinbeck-Lab/sherlock",
  },
  {
    slug: "nmrkit",
    name: "NMRKit",
    category: "Developer resources",
    description:
      "Microservices for NMR data: prediction, validation, depiction and format conversion.",
    url: "https://github.com/NFDI4Chem/nmrkit",
  },
];
