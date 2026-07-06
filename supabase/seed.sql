-- ============================================================
-- Chavruta v1 — source texts seed
-- Run in Supabase SQL editor after the schema migration.
-- All links are open access or public domain.
--
-- Curation notes:
--   • Texts selected for "entry cost vs. depth of discussion" ratio —
--     short enough to read before a session, rich enough to sustain 45 min.
--   • Deliberately cross-domain: a physicist and a historian can both
--     find purchase in most of these.
--   • No paywalled sources. Everything links to a full, free text.
--   • Add your own before launch; this is a starting set, not a final list.
--   • body_or_link can be a URL or pasted plain text (≤10,000 chars).
--     For URLs, the session page renders them as a clickable link.
-- ============================================================

insert into chavruta.source_texts (title, body_or_link, topic_tag) values

-- ── Philosophy of knowledge ────────────────────────────────────────────────

(
  'Plato — Meno (excerpt: the paradox of inquiry)',
  'https://classics.mit.edu/Plato/meno.html',
  'philosophy'
),
(
  'Descartes — Meditations on First Philosophy, Meditation I',
  'https://www.gutenberg.org/files/59/59-h/59-h.htm',
  'philosophy'
),
(
  'Wittgenstein — On Certainty §§1–65',
  'https://archive.org/details/oncertainty00witt',
  'philosophy'
),
(
  'Thomas Kuhn — The Structure of Scientific Revolutions, Chapter II: The Route to Normal Science',
  'https://archive.org/details/structureofscien0000kuhn',
  'philosophy of science'
),

-- ── Economics and institutions ──────────────────────────────────────────────

(
  'Adam Smith — The Wealth of Nations, Book I Chapter 1 (Division of Labour)',
  'https://www.gutenberg.org/files/3300/3300-h/3300-h.htm',
  'economics'
),
(
  'Friedrich Hayek — The Use of Knowledge in Society (1945)',
  'https://www.econlib.org/library/Essays/hykKnw.html',
  'economics'
),
(
  'Elinor Ostrom — Governing the Commons, Chapter 1',
  'https://archive.org/details/governingthecomm00ostr',
  'economics'
),

-- ── History and society ────────────────────────────────────────────────────

(
  'Alexis de Tocqueville — Democracy in America, Vol. II Part 4 Ch. 6: What Sort of Despotism Democratic Nations Have to Fear',
  'https://www.gutenberg.org/files/816/816-h/816-h.htm',
  'history'
),
(
  'Hannah Arendt — The Origins of Totalitarianism, Preface to the First Edition',
  'https://archive.org/details/originsoftotali000aren',
  'history'
),
(
  'Ibn Khaldun — The Muqaddimah, Introduction and Book 1 (excerpt: Asabiyyah)',
  'https://archive.org/details/muqaddimahintrod00khaldun',
  'history'
),

-- ── Science and nature ─────────────────────────────────────────────────────

(
  'Richard Feynman — The Character of Physical Law, Chapter 1: The Law of Gravitation',
  'https://archive.org/details/characterofphysi0000feyn',
  'science'
),
(
  'Charles Darwin — On the Origin of Species, Chapter 3: Struggle for Existence',
  'https://www.gutenberg.org/files/1228/1228-h/1228-h.htm',
  'science'
),
(
  'Lewis Thomas — The Lives of a Cell: Notes of a Biology Watcher (essay: "On Societies as Organisms")',
  'https://archive.org/details/livesofcell00thom',
  'science'
),

-- ── Language and mind ──────────────────────────────────────────────────────

(
  'George Orwell — Politics and the English Language (1946)',
  'https://www.orwell.ru/library/essays/politics/english/e_polit',
  'language'
),
(
  'Benjamin Lee Whorf — Language, Thought, and Reality (excerpt: The Relation of Habitual Thought and Behavior to Language)',
  'https://archive.org/details/languagethoughtr00whor',
  'language'
),
(
  'William James — The Principles of Psychology, Chapter 11: Attention',
  'https://archive.org/details/theprinciplesofp01jame',
  'mind'
),

-- ── Ethics and justice ─────────────────────────────────────────────────────

(
  'John Rawls — A Theory of Justice, §§1–4 (The Role of Justice)',
  'https://archive.org/details/theoryofjustice00rawl',
  'ethics'
),
(
  'Immanuel Kant — Groundwork of the Metaphysics of Morals, Preface and Section I',
  'https://www.gutenberg.org/files/5682/5682-h/5682-h.htm',
  'ethics'
),
(
  'Peter Singer — Famine, Affluence, and Morality (1972)',
  'https://www.utilitarian.net/singer/by/1972----.htm',
  'ethics'
),

-- ── Literature and interpretation ─────────────────────────────────────────

(
  'Kafka — Before the Law (parable from The Trial)',
  'https://www.kafka-online.info/before-the-law.html',
  'literature'
),
(
  'Jorge Luis Borges — The Garden of Forking Paths',
  'https://archive.org/details/ficciones00borg',
  'literature'
),
(
  'Virginia Woolf — A Room of One''s Own, Chapter 1',
  'https://www.gutenberg.org/files/5901/5901-h/5901-h.htm',
  'literature'
),

-- ── Technology and society ────────────────────────────────────────────────

(
  'Vannevar Bush — As We May Think (The Atlantic, 1945)',
  'https://www.theatlantic.com/magazine/archive/1945/07/as-we-may-think/303881/',
  'technology'
),
(
  'Ivan Illich — Tools for Conviviality, Chapter 1: The Two Watersheds',
  'https://archive.org/details/toolsforconvivialillich',
  'technology'
),

-- ── Jewish intellectual tradition (fits the Chavruta origin) ──────────────

(
  'Maimonides — Guide for the Perplexed, Introduction (on the nature of wisdom and the limits of speech)',
  'https://www.gutenberg.org/files/37452/37452-h/37452-h.htm',
  'philosophy'
);
