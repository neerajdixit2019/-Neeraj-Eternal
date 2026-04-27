const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 5180);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".jsx": "text/babel; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".md": "text/plain; charset=utf-8"
};

// ─── Scripture API data ───────────────────────────────────────────────────────

const WISDOM_BY_THEME = {
  longing: {
    acknowledgment: "Longing is a form of love. It does not need to disappear for you to heal.",
    scriptures: [
      { quote: "The wound is the place where the light enters you.", source: "Rumi", reference: "Masnavi" },
      { quote: "Out beyond ideas of wrongdoing and rightdoing, there is a field. I'll meet you there.", source: "Rumi", reference: "Masnavi" },
      { quote: "Do not grieve. Everything you lose comes round in another form.", source: "Rumi", reference: "Masnavi" },
      { quote: "Verily, with hardship comes ease.", source: "Quran", reference: "Surah Al-Inshirah 94:5" },
      { quote: "Even after all this time, the sun never says to the earth: you owe me.", source: "Hafiz", reference: "Persian poetry" }
    ]
  },
  anxiety: {
    acknowledgment: "Your mind is working hard to protect you from something it cannot see yet.",
    scriptures: [
      { quote: "You have a right to perform your prescribed duties, but you are not entitled to the fruits of your actions.", source: "Bhagavad Gita", reference: "Chapter 2, Verse 47" },
      { quote: "Do not worry about tomorrow, for tomorrow will worry about itself.", source: "Bible", reference: "Matthew 6:34" },
      { quote: "Cast all your anxiety on him because he cares for you.", source: "Bible", reference: "1 Peter 5:7" },
      { quote: "Peace I leave with you; my peace I give to you. Do not let your hearts be troubled.", source: "Bible", reference: "John 14:27" }
    ]
  },
  rejection: {
    acknowledgment: "Not being chosen by someone does not mean you are not worth choosing.",
    scriptures: [
      { quote: "Your task is not to seek for love, but merely to seek and find all the barriers within yourself that you have built against it.", source: "Rumi", reference: "Masnavi" },
      { quote: "We have honored the children of Adam and carried them on land and sea.", source: "Quran", reference: "Surah Al-Isra 17:70" },
      { quote: "You yourself, as much as anybody in the entire universe, deserve your love and affection.", source: "Buddha", reference: "Dhammapada" },
      { quote: "For you created my inmost being; you knit me together in my mother's womb.", source: "Bible", reference: "Psalm 139:13" }
    ]
  },
  heavy: {
    acknowledgment: "You have been carrying something heavy for a long time. You do not have to carry it alone.",
    scriptures: [
      { quote: "Come to me, all you who are weary and burdened, and I will give you rest.", source: "Bible", reference: "Matthew 11:28" },
      { quote: "God does not burden a soul beyond that it can bear.", source: "Quran", reference: "Surah Al-Baqarah 2:286" },
      { quote: "Even the longest night ends at dawn.", source: "Rumi", reference: "Masnavi" }
    ]
  },
  numb: {
    acknowledgment: "When we feel nothing, it is often because we have felt too much. This is protection, not emptiness.",
    scriptures: [
      { quote: "This too shall pass.", source: "Persian proverb", reference: "Ancient wisdom" },
      { quote: "Nothing is permanent. Everything is in a state of flux.", source: "Buddha", reference: "Dhammapada" },
      { quote: "Even after all this time, the sun never says to the earth: you owe me.", source: "Hafiz", reference: "Persian poetry" }
    ]
  },
  loss: {
    acknowledgment: "Grief is what love looks like when it has nowhere to go.",
    scriptures: [
      { quote: "Verily, with every hardship comes ease.", source: "Quran", reference: "Surah Al-Inshirah 94:5-6" },
      { quote: "Blessed are those who mourn, for they will be comforted.", source: "Bible", reference: "Matthew 5:4" },
      { quote: "Do not grieve. Everything you lose comes round in another form.", source: "Rumi", reference: "Masnavi" }
    ]
  },
  "self-worth": {
    acknowledgment: "Your value is not measured by how someone treated you.",
    scriptures: [
      { quote: "We have honored the children of Adam and carried them on land and sea.", source: "Quran", reference: "Surah Al-Isra 17:70" },
      { quote: "For you created my inmost being; you knit me together in my mother's womb. I am fearfully and wonderfully made.", source: "Bible", reference: "Psalm 139:13-14" },
      { quote: "You yourself, as much as anybody in the entire universe, deserve your love and affection.", source: "Buddha", reference: "Dhammapada" },
      { quote: "Do not compare yourself with others. You have your own dharma to fulfill.", source: "Bhagavad Gita", reference: "Chapter 3" }
    ]
  },
  hope: {
    acknowledgment: "There is something in you that still believes things can be different. That is worth holding onto.",
    scriptures: [
      { quote: "And after every difficulty, there is relief.", source: "Quran", reference: "Surah Al-Inshirah 94:6" },
      { quote: "For I know the plans I have for you — plans to prosper you and not to harm you, plans to give you hope and a future.", source: "Bible", reference: "Jeremiah 29:11" },
      { quote: "Even the darkest night will end and the sun will rise.", source: "Victor Hugo", reference: "Les Miserables" }
    ]
  },
  "letting-go": {
    acknowledgment: "Letting go is not forgetting. It is choosing yourself.",
    scriptures: [
      { quote: "You only lose what you cling to.", source: "Buddha", reference: "Dhammapada" },
      { quote: "Be like a tree and let the dead leaves drop.", source: "Rumi", reference: "Masnavi" },
      { quote: "Let all bitterness and wrath and anger and clamor and slander be put away from you.", source: "Bible", reference: "Ephesians 4:31" }
    ]
  },
  overthinking: {
    acknowledgment: "Your mind is searching for certainty where there may not be any. That is exhausting to carry.",
    scriptures: [
      { quote: "The mind is everything. What you think, you become.", source: "Buddha", reference: "Dhammapada" },
      { quote: "You have power over your mind, not outside events. Realize this and you will find strength.", source: "Marcus Aurelius", reference: "Meditations" },
      { quote: "Stop acting so small. You are the universe in ecstatic motion.", source: "Rumi", reference: "Masnavi" }
    ]
  },
  lost: {
    acknowledgment: "Feeling lost often means you have outgrown where you were. That is the first step forward.",
    scriptures: [
      { quote: "Trust in the Lord with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight.", source: "Bible", reference: "Proverbs 3:5-6" },
      { quote: "Do not lose yourself in the ordinary. Be extraordinary by staying true to your dharma.", source: "Bhagavad Gita", reference: "Chapter 18" },
      { quote: "Wherever you are is the entry point.", source: "Kabir", reference: "Dohas" }
    ]
  }
};

function detectTheme(text) {
  const lower = (text || "").toLowerCase();
  if (/(miss |missing|longing|long for|without (you|them)|want (them|him|her) back)/.test(lower)) return "longing";
  if (/(worr|anxious|scared|afraid|fear|nervous|panic|what if)/.test(lower)) return "anxiety";
  if (/(rejected|not chosen|not enough|left me|chose (her|him)|don't want me)/.test(lower)) return "rejection";
  if (/(heavy|tired|exhausted|overwhelmed|too much|drained)/.test(lower)) return "heavy";
  if (/(numb|empty|don't feel|can't feel|hollow|blank)/.test(lower)) return "numb";
  if (/(lost|confused|don't know (who|what|where)|direction|purpose|pointless)/.test(lower)) return "lost";
  if (/(worthless|useless|don't deserve|not worthy|hate myself)/.test(lower)) return "self-worth";
  if (/(let go|move on|holding on|can't move|stuck|can't forget)/.test(lower)) return "letting-go";
  if (/(hope|will it get better|going to be okay|future|forward)/.test(lower)) return "hope";
  if (/(keep thinking|can't stop thinking|overthinking|racing thoughts)/.test(lower)) return "overthinking";
  if (/(ended|over|breakup|they left|it's over)/.test(lower)) return "loss";
  return "longing";
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function handleApiRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);

  // GET /api/scriptures — return all themes and their scriptures
  if (request.method === "GET" && url.pathname === "/api/scriptures") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ themes: Object.keys(WISDOM_BY_THEME), data: WISDOM_BY_THEME }));
    return true;
  }

  // GET /api/wisdom/:theme — return scriptures for a specific theme
  const themeMatch = url.pathname.match(/^\/api\/wisdom\/([a-z-]+)$/);
  if (request.method === "GET" && themeMatch) {
    const theme = themeMatch[1];
    const themeData = WISDOM_BY_THEME[theme];
    if (!themeData) {
      response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: "Theme not found", availableThemes: Object.keys(WISDOM_BY_THEME) }));
    } else {
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ theme, ...themeData }));
    }
    return true;
  }

  // POST /api/wisdom — detect theme from text, return a scripture
  if (request.method === "POST" && url.pathname === "/api/wisdom") {
    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      let parsed = {};
      try { parsed = JSON.parse(body); } catch { /* ignore */ }

      const theme = parsed.theme || detectTheme(parsed.text || "");
      const themeData = WISDOM_BY_THEME[theme] || WISDOM_BY_THEME.longing;
      const scripture = randomFrom(themeData.scriptures);

      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({
        theme,
        acknowledgment: themeData.acknowledgment,
        scripture
      }));
    });
    return true;
  }

  return false;
}

// ─── Static file server ───────────────────────────────────────────────────────

const server = http.createServer((request, response) => {
  if (request.url.startsWith("/api/")) {
    if (!handleApiRequest(request, response)) {
      response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: "Not found" }));
    }
    return;
  }

  const requestPath = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  let filePath = path.resolve(root, requestPath === "/" ? "index.html" : requestPath.slice(1));

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      if (!path.extname(filePath)) {
        const fallbackPath = path.resolve(root, "index.html");
        fs.readFile(fallbackPath, (fallbackError, fallbackData) => {
          if (fallbackError) {
            response.writeHead(404);
            response.end("Not found");
            return;
          }
          response.writeHead(200, { "Content-Type": contentTypes[".html"] });
          response.end(fallbackData);
        });
        return;
      }
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream"
    });
    response.end(data);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Neeraj Eternal running at http://127.0.0.1:${port}`);
  console.log(`Scripture API: http://127.0.0.1:${port}/api/scriptures`);
});
