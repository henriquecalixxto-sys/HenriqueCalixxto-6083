import { db } from "./database";
import * as schema from "./database/schema";
import { guardDestructiveScript } from "./lib/guard-script";

guardDestructiveScript("seed");

const services = [
  {
    slug: "certified-translation",
    title: "Certified Translation",
    icon: "Languages",
    order: 1,
    shortDescription: "USCIS-accepted certified translations for immigration, academic, and legal documents.",
    overview:
      "Calixto Agency provides certified translations that meet the standards required by USCIS, courts, universities, and government agencies. Every translation is accompanied by a signed Certificate of Accuracy, ensuring your documents are accepted the first time.",
    benefits: JSON.stringify([
      "Accepted by USCIS, courts, and universities nationwide",
      "Signed Certificate of Accuracy included with every order",
      "Fast turnaround, with expedited options available",
      "Confidential handling of personal and legal documents",
      "Available in all major languages",
    ]),
    process: JSON.stringify([
      "Upload your document securely through our client portal",
      "We review the document and confirm scope and timeline",
      "Our professional linguists complete the certified translation",
      "You receive the certified translation and signed certificate",
    ]),
    faq: JSON.stringify([
      {
        q: "Is a certified translation the same as a notarized translation?",
        a: "A certified translation includes a signed Certificate of Accuracy. A notarized translation adds a notary's acknowledgment of the translator's signature. We offer both.",
      },
      {
        q: "Which agencies accept your certified translations?",
        a: "Our certified translations are prepared to meet USCIS, court, and academic institution requirements nationwide.",
      },
    ]),
  },
  {
    slug: "notary-public",
    title: "Notary Public",
    icon: "Stamp",
    order: 2,
    shortDescription: "Licensed notary public services for personal, business, and legal documents.",
    overview:
      "Our licensed Notary Public provides professional notarization services for a wide range of documents, ensuring your paperwork is properly witnessed and executed in accordance with Connecticut law.",
    benefits: JSON.stringify([
      "Licensed and bonded notary public",
      "Flexible scheduling, including mobile notary options",
      "Careful, professional handling of sensitive documents",
      "Fast, same-day appointments available",
    ]),
    process: JSON.stringify([
      "Schedule an appointment or request mobile notary service",
      "Bring valid photo ID and the documents requiring notarization",
      "Sign in the presence of our notary public",
      "Receive your properly notarized documents",
    ]),
    faq: JSON.stringify([
      {
        q: "What identification do I need?",
        a: "A valid, unexpired government-issued photo ID such as a driver's license or passport.",
      },
      { q: "Do you offer mobile notary services?", a: "Yes, we can travel to your home or office by appointment." },
    ]),
  },
  {
    slug: "apostille-services",
    title: "Apostille Services",
    icon: "Stamp",
    order: 3,
    shortDescription: "Document authentication for international use through the apostille process.",
    overview:
      "We manage the full apostille process on your behalf, coordinating with the Connecticut Secretary of the State and U.S. Department of State to authenticate your documents for use abroad.",
    benefits: JSON.stringify([
      "Full-service handling — we manage the submission for you",
      "Experience with state and federal apostille requirements",
      "Clear timelines and status updates",
      "Support for personal, business, and educational documents",
    ]),
    process: JSON.stringify([
      "Submit your original document through our secure portal",
      "We verify eligibility and prepare the required forms",
      "We submit your document to the appropriate authenticating authority",
      "Your apostilled document is returned to you securely",
    ]),
    faq: JSON.stringify([
      {
        q: "What is an apostille?",
        a: "An apostille is a certificate that authenticates the origin of a public document for use in another country that participates in the Hague Convention.",
      },
      { q: "How long does the process take?", a: "Timelines vary by issuing authority; we provide an estimate before starting." },
    ]),
  },
  {
    slug: "document-preparation",
    title: "Document Preparation",
    icon: "FileEdit",
    order: 4,
    shortDescription: "Professional preparation and formatting of personal and business documents.",
    overview:
      "We assist with the accurate preparation, formatting, and organization of a wide range of personal and business documents, ensuring they are complete and presented professionally.",
    benefits: JSON.stringify([
      "Meticulous attention to detail and formatting standards",
      "Organized, professional final documents",
      "Guidance on required supporting materials",
      "Confidential and secure handling",
    ]),
    process: JSON.stringify([
      "Share your requirements and any existing materials",
      "We prepare and format your documents",
      "You review a draft for accuracy",
      "We finalize and deliver your completed documents",
    ]),
    faq: JSON.stringify([
      {
        q: "Does this include legal advice?",
        a: "No. Calixto Agency provides document preparation services only and does not provide legal advice or representation.",
      },
    ]),
  },
  {
    slug: "business-documentation",
    title: "Business Documentation",
    icon: "Briefcase",
    order: 5,
    shortDescription: "Organized preparation of business formation, compliance, and administrative documents.",
    overview:
      "From formation paperwork to ongoing administrative filings, we help businesses keep their documentation organized, accurate, and ready for submission.",
    benefits: JSON.stringify([
      "Support for formation and compliance paperwork",
      "Consistent, organized recordkeeping",
      "Confidential handling of sensitive business information",
      "Reliable turnaround for time-sensitive filings",
    ]),
    process: JSON.stringify([
      "Tell us about your business documentation needs",
      "We prepare and organize the required materials",
      "You review and approve the final documentation",
      "We deliver completed documents ready for filing or use",
    ]),
    faq: JSON.stringify([
      { q: "Can you file documents with the state on our behalf?", a: "We assist with preparation and submission coordination for eligible filings." },
    ]),
  },
  {
    slug: "administrative-assistance",
    title: "Administrative Assistance",
    icon: "ClipboardList",
    order: 6,
    shortDescription: "Reliable administrative support for document-heavy personal and business needs.",
    overview:
      "Our administrative assistance services help individuals and businesses manage document-heavy processes efficiently, accurately, and confidentially.",
    benefits: JSON.stringify([
      "Dedicated, detail-oriented support",
      "Efficient handling of recurring administrative needs",
      "Clear communication throughout every engagement",
      "Confidentiality guaranteed",
    ]),
    process: JSON.stringify([
      "Describe the administrative task or ongoing need",
      "We scope the engagement and timeline",
      "Our team completes the work with regular updates",
      "You receive completed materials and a summary",
    ]),
    faq: JSON.stringify([{ q: "Can this be an ongoing engagement?", a: "Yes, we support both one-time and recurring administrative needs." }]),
  },
  {
    slug: "affidavits",
    title: "Affidavits",
    icon: "FileSignature",
    order: 7,
    shortDescription: "Preparation and notarization of sworn affidavits for personal and legal use.",
    overview:
      "We assist in preparing affidavits — written, sworn statements of fact — and provide notarization to ensure they meet formal execution requirements.",
    benefits: JSON.stringify([
      "Careful, accurate document preparation",
      "In-house notarization available",
      "Confidential handling of sensitive statements",
      "Fast turnaround for time-sensitive matters",
    ]),
    process: JSON.stringify([
      "Share the details of the statement to be sworn",
      "We prepare the affidavit document",
      "You review and sign before our notary public",
      "You receive your properly executed affidavit",
    ]),
    faq: JSON.stringify([{ q: "Do I need to appear in person?", a: "Yes, affidavits require signature in the physical presence of a notary public." }]),
  },
  {
    slug: "power-of-attorney-assistance",
    title: "Power of Attorney Assistance",
    icon: "FileCheck2",
    order: 8,
    shortDescription: "Document preparation and notarization support for powers of attorney.",
    overview:
      "We help prepare and properly execute power of attorney documents, ensuring correct formatting and notarization so your document is ready for its intended use.",
    benefits: JSON.stringify([
      "Careful document preparation support",
      "In-house notarization services",
      "Confidential and professional handling",
      "Clear guidance on the execution process",
    ]),
    process: JSON.stringify([
      "Provide the details of the power of attorney needed",
      "We prepare the document for your review",
      "You sign in the presence of our notary public",
      "You receive your finalized, notarized document",
    ]),
    faq: JSON.stringify([
      { q: "Can Calixto Agency tell me what powers to include?", a: "We do not provide legal advice; we recommend consulting an attorney for legal guidance on scope." },
    ]),
  },
  {
    slug: "immigration-document-assistance",
    title: "Immigration Document Assistance",
    icon: "Globe2",
    order: 9,
    shortDescription: "Document preparation, translation, and organization support for immigration filings.",
    overview:
      "We support individuals navigating immigration processes with certified translations, document organization, and preparation of supporting materials — always as a document services provider, never as legal counsel.",
    benefits: JSON.stringify([
      "Certified translations accepted by USCIS",
      "Organized preparation of supporting documentation",
      "Confidential, careful handling of sensitive records",
      "Experience with common immigration document requirements",
    ]),
    process: JSON.stringify([
      "Share the list of documents required for your filing",
      "We translate, organize, and prepare your materials",
      "You review the completed package",
      "You receive your organized, submission-ready documents",
    ]),
    faq: JSON.stringify([
      {
        q: "Can you represent me before USCIS or in immigration court?",
        a: "No. Calixto Agency does not provide legal representation or legal advice. We recommend consulting a licensed immigration attorney for legal matters.",
      },
    ]),
  },
  {
    slug: "certified-copies",
    title: "Certified Copies",
    icon: "Copy",
    order: 10,
    shortDescription: "Certified true copies of original documents for official and personal use.",
    overview:
      "We provide certified copies of original documents, verified and attested for use where an official duplicate is required.",
    benefits: JSON.stringify([
      "Properly certified true copies",
      "Fast processing for time-sensitive needs",
      "Secure handling of original documents",
      "Accepted for a wide range of institutional uses",
    ]),
    process: JSON.stringify([
      "Bring or securely upload your original document",
      "We verify and prepare the certified copy",
      "The copy is certified as a true copy of the original",
      "You receive your original and certified copy",
    ]),
    faq: JSON.stringify([{ q: "Will my original document be safe?", a: "Yes, originals are handled with strict confidentiality and returned to you." }]),
  },
];

const testimonials = [
  { name: "Marcus R.", role: "Small Business Owner, Bridgeport CT", quote: "Calixto Agency handled our business documentation with a level of precision and discretion I haven't found anywhere else. Everything was organized, on time, and exactly as promised.", rating: 5, order: 1 },
  { name: "Elena V.", role: "Immigration Client", quote: "The certified translation was accepted without a single question from USCIS. Professional, fast, and genuinely reassuring during a stressful process.", rating: 5, order: 2 },
  { name: "James P.", role: "Real Estate Investor", quote: "I needed notarization and an apostille on a tight deadline. Calixto Agency delivered ahead of schedule with impeccable communication throughout.", rating: 5, order: 3 },
];

const faqs = [
  { category: "General", question: "Does Calixto Agency provide legal advice?", answer: "No. Calixto Agency provides document services only and does not provide legal representation or legal advice. For legal counsel, please consult a licensed attorney.", order: 1 },
  { category: "General", question: "How do I get started?", answer: "Request a quote through our website or client portal, and our team will confirm the scope and timeline for your document needs.", order: 2 },
  { category: "Translation", question: "Are your translations accepted by USCIS?", answer: "Yes, our certified translations are prepared to meet USCIS acceptance standards, accompanied by a signed Certificate of Accuracy.", order: 1 },
  { category: "Notary", question: "Do you offer mobile notary services?", answer: "Yes, we can travel to your location by appointment for an additional fee.", order: 1 },
  { category: "Apostille", question: "Which documents can receive an apostille?", answer: "Most public documents, including birth certificates, diplomas, and corporate documents, are eligible depending on issuing authority.", order: 1 },
  { category: "Security", question: "How is my information kept confidential?", answer: "All documents are handled under strict confidentiality protocols, with secure digital storage and limited access controls.", order: 1 },
];

const blogPosts = [
  {
    slug: "understanding-uscis-certified-translations",
    title: "Understanding USCIS Certified Translation Requirements",
    category: "USCIS",
    excerpt: "What makes a translation 'certified' in the eyes of USCIS, and how to avoid common rejection reasons.",
    content: "USCIS requires that any foreign-language document submitted with an application be accompanied by a full English translation, along with a certification from the translator attesting to their competence and the accuracy of the translation. Common rejection reasons include missing certification statements, incomplete translations, and unqualified translators. Calixto Agency prepares translations that meet these standards, backed by a signed Certificate of Accuracy.",
    coverImage: null,
  },
  {
    slug: "apostille-vs-notarization-difference",
    title: "Apostille vs. Notarization: What's the Difference?",
    category: "Apostille",
    excerpt: "Two commonly confused document authentication processes, explained clearly.",
    content: "Notarization verifies the identity of a signer and witnesses the signing of a document. An apostille, by contrast, authenticates the origin of a public document — confirming the seal and signature of the official who issued or certified it — for use in another country under the Hague Convention. Many international processes require both: notarization first, followed by an apostille from the Secretary of State.",
    coverImage: null,
  },
  {
    slug: "connecticut-notary-public-guide",
    title: "A Practical Guide to Notary Public Services in Connecticut",
    category: "Connecticut",
    excerpt: "What to bring, what to expect, and how the notarization process works in Connecticut.",
    content: "Connecticut notaries public are commissioned by the Secretary of the State and authorized to witness signatures, administer oaths, and certify documents. To have a document notarized, bring a valid government-issued photo ID and do not sign the document beforehand — it must be signed in the notary's presence. Calixto Agency offers both in-office and mobile notary appointments throughout Bridgeport and the surrounding area.",
    coverImage: null,
  },
  {
    slug: "organizing-business-documents-for-growth",
    title: "Why Organized Business Documentation Matters for Growth",
    category: "Business",
    excerpt: "How disciplined document management reduces risk and supports scaling.",
    content: "As businesses grow, documentation requirements multiply — formation records, compliance filings, contracts, and administrative paperwork. Disciplined organization reduces the risk of missed deadlines and lost records, and presents a more professional posture to partners, lenders, and regulators. Calixto Agency supports businesses with consistent, accurate documentation preparation and recordkeeping.",
    coverImage: null,
  },
];

async function seed() {
  console.log("Seeding services...");
  for (const s of services) {
    await db.insert(schema.services).values(s).onConflictDoNothing();
  }
  console.log("Seeding testimonials...");
  for (const t of testimonials) {
    await db.insert(schema.testimonials).values(t).onConflictDoNothing();
  }
  console.log("Seeding FAQs...");
  for (const f of faqs) {
    await db.insert(schema.faqs).values(f).onConflictDoNothing();
  }
  console.log("Seeding blog posts...");
  for (const b of blogPosts) {
    await db.insert(schema.blogPosts).values(b).onConflictDoNothing();
  }
  console.log("Seed complete.");
}

seed().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
