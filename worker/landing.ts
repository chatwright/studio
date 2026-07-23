export const landingDocument = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="description" content="Chatwright is an open-source, local-first Telegram Bot API emulator. Real webhooks, real bot, deterministic assertions — offline, in CI, no test account needed.">
    <title>Chatwright — Test Telegram bots locally with an emulated Bot API</title>
    <link rel="canonical" href="https://chatwright.dev/">
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23111827'/%3E%3Crect x='14' y='16' width='36' height='24' rx='7' fill='%2350cba0'/%3E%3Cpath d='M22 40 L22 48 L30 40 Z' fill='%2350cba0'/%3E%3C/svg%3E">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Chatwright">
    <meta property="og:title" content="Chatwright — Test Telegram bots locally with an emulated Bot API">
    <meta property="og:description" content="An open-source, local-first emulator for the Telegram Bot API. Real webhooks, real bot, deterministic assertions — offline and in CI.">
    <meta property="og:url" content="https://chatwright.dev/">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="Chatwright — Test Telegram bots locally with an emulated Bot API">
    <meta name="twitter:description" content="An open-source, local-first emulator for the Telegram Bot API. Real webhooks, real bot, deterministic assertions — offline and in CI.">
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"SoftwareApplication","name":"Chatwright","description":"Chatwright is an open, local-first conversation development platform that emulates messaging platforms — starting with the Telegram Bot API — so you can test real bots deterministically, offline, and in CI.","applicationCategory":"DeveloperApplication","operatingSystem":"macOS, Linux, Windows","url":"https://chatwright.dev/","codeRepository":"https://github.com/chatwright/chatwright","license":"https://www.apache.org/licenses/LICENSE-2.0","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"},"publisher":{"@type":"Organization","name":"Sneat.co","url":"https://sneat.co"}}</script>
    <style>
      :root { color-scheme: light; --ink:#111827; --soft:#566477; --line:#e5eaf0; --canvas:#fcfcfd; --blue:#2c6dcc; --mint:#50cba0; --mint-ink:#0d5e49; font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
      * { box-sizing:border-box; } html { scroll-behavior:smooth; } body { margin:0; color:var(--ink); background:var(--canvas); } a { color:inherit; }
      .wrap { width:min(1180px,calc(100% - 3rem)); margin-inline:auto; }
      .nav { position:sticky; z-index:10; top:0; border-bottom:1px solid rgba(229,234,240,.9); background:rgba(252,252,253,.9); backdrop-filter:blur(16px); }
      .nav > .wrap { min-height:72px; display:flex; align-items:center; justify-content:space-between; gap:1.2rem; }
      .brand { color:var(--ink); font-size:1.1rem; font-weight:730; letter-spacing:-.05em; text-decoration:none; } .brand small { margin-left:.45rem; color:var(--soft); font-size:.65rem; font-weight:650; letter-spacing:.02em; }
      .links { display:flex; align-items:center; gap:1.35rem; color:#4e5c70; font-size:.85rem; } .links a { text-decoration:none; } .links a:hover { color:var(--ink); }
      .button { min-height:2.7rem; display:inline-flex; align-items:center; justify-content:center; padding:0 .95rem; border:1px solid transparent; border-radius:.55rem; font:680 .84rem/1 inherit; text-decoration:none; transition:transform .18s ease,box-shadow .18s ease; } .button:hover { transform:translateY(-1px); }
      .primary { color:#06271d; background:var(--mint); box-shadow:0 8px 20px rgba(80,203,160,.17); } .quiet { border-color:var(--line); background:#fff; }
      .hero { display:grid; grid-template-columns:minmax(19rem,.82fr) minmax(32rem,1.18fr); align-items:center; gap:clamp(2.5rem,6vw,5.6rem); padding:clamp(5rem,9vw,8rem) 0 clamp(5.5rem,10vw,9rem); } .hero-intro { text-align:left; } .eyebrow { margin:0 0 1rem; color:var(--blue); font:700 .7rem/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; letter-spacing:.12em; text-transform:uppercase; }
      h1 { max-width:10ch; margin:0; font-size:clamp(3rem,5.25vw,5.15rem); line-height:.97; letter-spacing:-.078em; } .hero-copy { max-width:32rem; margin:1.4rem 0 0; color:var(--soft); font-size:clamp(1.02rem,1.35vw,1.17rem); line-height:1.6; }
      .actions { display:flex; justify-content:flex-start; flex-wrap:wrap; gap:.7rem; margin-top:1.75rem; } .proof { display:flex; justify-content:flex-start; flex-wrap:wrap; align-items:center; gap:.55rem 1rem; margin:1.25rem 0 0; color:#687588; font-size:.76rem; } .proof span::before { content:""; display:inline-block; width:.38rem; height:.38rem; margin:0 .36rem .06rem 0; border-radius:50%; background:var(--mint-ink); } .proof .offline { padding:.36rem .56rem; border:1px solid #bce9d8; border-radius:.42rem; color:var(--mint-ink); background:#effbf5; font-weight:800; box-shadow:0 5px 14px rgba(80,203,160,.13); } .proof .offline::before { margin-bottom:.03rem; }
      .hero-terminal { max-width:29rem; margin:1.65rem 0 0; } .hero-preview { min-width:0; } .preview-head { display:flex; align-items:end; justify-content:space-between; gap:1rem; margin:0 0 .85rem; } .preview-head h2 { margin:0; font-size:1rem; letter-spacing:-.025em; } .preview-head p { margin:.25rem 0 0; color:var(--soft); font-size:.83rem; } .preview-head a { color:var(--mint-ink); font-size:.8rem; font-weight:700; text-decoration:none; }
      .browser { overflow:hidden; border:1px solid #dce3ea; border-radius:1rem; background:#101925; box-shadow:0 28px 70px rgba(29,43,60,.14); } .browser-bar { min-height:3.25rem; display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:.75rem; padding:.55rem .7rem .55rem 1rem; border-bottom:1px solid rgba(228,236,245,.13); background:#172231; }
      .address { min-width:0; overflow:hidden; padding:.48rem .7rem; border:1px solid rgba(228,236,245,.12); border-radius:.42rem; color:#d9e3ef; background:#101925; font:500 .69rem/1.1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; text-decoration:none; text-overflow:ellipsis; white-space:nowrap; } .address:hover { color:#fff; border-color:rgba(140,227,184,.55); }
      iframe { display:block; width:100%; height:min(660px,53vw); min-height:500px; border:0; background:#101925; }
      .why { display:grid; grid-template-columns:minmax(0,1.05fr) minmax(19rem,.95fr); align-items:start; gap:clamp(2rem,7vw,7rem); padding:0 0 clamp(5.5rem,10vw,9rem); } .why h2 { max-width:8.5ch; margin:0; font-size:clamp(2.25rem,4.3vw,4.25rem); line-height:1; letter-spacing:-.065em; } .why-copy { display:grid; gap:1.25rem; } .why-copy > p { margin:0; color:var(--soft); font-size:1.03rem; line-height:1.65; }
      .steps { display:grid; margin-top:.35rem; border-top:1px solid var(--line); } .step { display:grid; grid-template-columns:2.4rem 1fr; gap:.8rem; padding:1.1rem 0; border-bottom:1px solid var(--line); } .step > span { color:var(--blue); font:650 .72rem/1.7 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; } .step strong { display:block; font-size:.95rem; } .step p { margin:.25rem 0 0; color:var(--soft); font-size:.84rem; line-height:1.5; }
      .cli { padding:clamp(2.2rem,5vw,4rem); border:1px solid var(--line); border-radius:.9rem; background:#f7f9fb; } .cli > p { margin:0 0 .65rem; color:var(--blue); font:700 .68rem/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; letter-spacing:.11em; text-transform:uppercase; } .cli h2 { max-width:640px; margin:0; font-size:clamp(1.8rem,3vw,2.75rem); line-height:1.04; letter-spacing:-.055em; } pre { overflow:auto; margin:1.7rem 0 0; padding:1.1rem 1.2rem; border-radius:.65rem; color:#d5e4ef; background:#101925; font:500 .76rem/1.8 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; tab-size:2; } pre b { color:#8ce3b8; font-weight:inherit; } .callout { margin:1.4rem 0 0; color:var(--mint-ink); font:650 .85rem/1.55 inherit; } .cli + .cli { margin-top:2rem; }
      #status .step { grid-template-columns:5.6rem 1fr; } #status .step > span { letter-spacing:.03em; } #status .step > span.done { color:var(--mint-ink); }
      .sample { display:inline-flex; align-items:center; gap:.38rem; color:#9fb0c6; font:650 .67rem/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; text-transform:uppercase; letter-spacing:.06em; } .sample::before { content:""; width:.42rem; height:.42rem; border-radius:50%; background:currentColor; }
      .hero-files { display:flex; flex-wrap:wrap; gap:.55rem; margin:1.1rem 0 0; } .file-chip { flex:1 1 auto; min-width:9rem; display:flex; align-items:center; gap:.55rem; padding:.5rem .7rem; border:1px solid var(--line); border-radius:.6rem; background:#fff; cursor:grab; font:inherit; text-align:left; transition:border-color .15s ease,box-shadow .15s ease,transform .15s ease; } .file-chip:hover { border-color:var(--blue); box-shadow:0 6px 16px rgba(44,109,204,.14); transform:translateY(-1px); } .file-chip:active { cursor:grabbing; } .file-chip.active { border-color:var(--mint-ink); background:#effbf5; }
      .file-chip-icon { flex:0 0 auto; width:1.9rem; height:1.9rem; border-radius:.45rem; background:rgba(44,109,204,.12) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M6 2h9l5 5v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z' fill='none' stroke='%232c6dcc' stroke-width='1.6'/%3E%3Cpath d='M14 2v6h6' fill='none' stroke='%232c6dcc' stroke-width='1.6'/%3E%3C/svg%3E") no-repeat center/1.05rem; } .file-chip-body { display:flex; flex-direction:column; gap:.08rem; min-width:0; } .file-chip-title { font-size:.78rem; font-weight:680; color:var(--ink); } .file-chip-name { font-size:.65rem; color:var(--soft); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:13rem; }
      .hero-files-note { margin:.75rem 0 0; color:var(--soft); font-size:.78rem; } .hero-files-note code { padding:.05rem .32rem; border-radius:.3rem; background:#eef3f8; color:var(--mint-ink); font-size:.74rem; }
      footer { padding:2.5rem 0 3rem; color:#718094; font-size:.78rem; } footer .wrap { display:flex; justify-content:space-between; gap:1rem; border-top:1px solid var(--line); padding-top:1.45rem; } footer a { color:var(--soft); text-decoration:none; }
      .fade { animation:fade .65s both cubic-bezier(.2,.8,.2,1); } .delay { animation-delay:.12s; } @keyframes fade { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } } @media (prefers-reduced-motion:reduce) { *,*::before,*::after { animation-duration:.01ms!important; scroll-behavior:auto!important; transition-duration:.01ms!important; } }
      @media (max-width:960px) { .hero { grid-template-columns:1fr; text-align:center; } .hero-intro { text-align:center; } h1 { max-width:13ch; margin-inline:auto; } .hero-copy,.hero-terminal { margin-inline:auto; } .actions,.proof { justify-content:center; } }
      @media (max-width:720px) { .wrap { width:min(100% - 2rem,1180px); } .nav > .wrap { min-height:64px; } .links { display:none; } .brand small { display:none; } .hero { padding-top:4.6rem; } h1 { font-size:clamp(2.85rem,14vw,4.2rem); } .preview-head { align-items:start; flex-direction:column; } iframe { height:560px; min-height:0; } .why { grid-template-columns:1fr; } .why h2 { max-width:11ch; } footer .wrap { align-items:flex-start; flex-direction:column; } }
    </style>
  </head>
  <body>
    <header class="nav"><div class="wrap"><a class="brand" href="/" aria-label="Chatwright home">Chatwright <small>by sneat.dev</small></a><nav class="links" aria-label="Primary navigation"><a href="#player">Player</a><a href="#how-it-works">How it works</a><a href="#status">Status</a><a href="https://github.com/chatwright/chatwright">GitHub</a></nav><a class="button primary" href="/studio/">Open Studio</a></div></header>
    <main>
      <section class="hero wrap"><div class="hero-intro"><p class="eyebrow fade">Telegram Bot API emulator · local, deterministic testing</p><h1 class="fade">The platform is emulated.<br>Your bot is real.</h1><p class="hero-copy fade delay">Chatwright emulates the Telegram Bot API on your machine—not automation of someone’s Telegram client. Your bot answers real webhooks; every API call it makes becomes an assertion, with timing, not a guess.</p><pre class="hero-terminal fade delay"><b>$</b> go get chatwright.dev/runtime
<b>$</b> go test ./... -run TestGreeting
<b>ok</b>  chatwright.dev/runtime  0.315s</pre><div class="actions fade delay"><a class="button primary" href="#player">Watch the player run</a><a class="button quiet" href="https://github.com/chatwright/chatwright">View on GitHub</a></div><p class="proof"><span class="offline">Works offline</span><span>Open-source CLI · Apache-2.0</span><span>Telegram: text, actions, edits</span><span>WhatsApp: text (preview)</span></p></div><section id="player" class="hero-preview" aria-label="The Chatwright player, live"><div class="preview-head"><div><h2>The player, live</h2><p>The real Chatwright player, preloaded with a sample run bundle—not a recording.</p></div><a href="/studio/player">Open in a full tab →</a></div><div class="browser"><div class="browser-bar"><a class="address" href="/studio/player" target="_blank" rel="noopener" aria-label="Open the Chatwright player in a new tab">https://chatwright.dev/studio/player</a><span class="sample">Sample run bundle</span></div><iframe id="hero-player" data-src="/studio/player?embed=1&amp;sample=greetbot-two-part.chatwright.json" title="Chatwright player, preloaded with a sample run bundle" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe><noscript><iframe src="/studio/player?embed=1&amp;sample=greetbot-two-part.chatwright.json" title="Chatwright player, preloaded with a sample run bundle" loading="lazy"></iframe></noscript></div><div class="hero-files" role="group" aria-label="Sample run bundles — click to load one, or drag your own from your computer onto the player"><button type="button" class="file-chip active" draggable="true" data-sample="greetbot-two-part.chatwright.json"><span class="file-chip-icon" aria-hidden="true"></span><span class="file-chip-body"><span class="file-chip-title">Greetbot — two parts</span><span class="file-chip-name mono">greetbot-two-part.chatwright.json</span></span></button><button type="button" class="file-chip" draggable="true" data-sample="greetbot-three-part.chatwright.json"><span class="file-chip-icon" aria-hidden="true"></span><span class="file-chip-body"><span class="file-chip-title">Greetbot — three parts</span><span class="file-chip-name mono">greetbot-three-part.chatwright.json</span></span></button><button type="button" class="file-chip" draggable="true" data-sample="debt-two-chat.chatwright.json"><span class="file-chip-icon" aria-hidden="true"></span><span class="file-chip-body"><span class="file-chip-title">Debt — two chats, three actors</span><span class="file-chip-name mono">debt-two-chat.chatwright.json</span></span></button></div><p class="hero-files-note">Click a sample to load it above—or drag your own <code>*.chatwright.json</code> run bundle onto the player.</p></section></section>
      <section id="how-it-works" class="why wrap"><h2>Every interaction stays explainable.</h2><div class="why-copy"><p>Chatwright drives a real conversation through emulated platform APIs, then correlates what a user saw with the exact webhook, API call and assertion behind it. Work locally—even offline—until you choose to share the evidence.</p><div class="steps"><article class="step"><span>01</span><div><strong>Script the intent</strong><p>Describe a conversation in platform-neutral terms, including what should appear and when.</p></div></article><article class="step"><span>02</span><div><strong>Exercise the platform</strong><p>The Telegram Platform Emulator handles the wire protocol—text, inline actions, edits—while your bot still talks over real HTTP.</p></div></article><article class="step"><span>03</span><div><strong>Inspect the evidence</strong><p>Trace a message from user action to rendered reply, payload, timing and final assertion.</p></div></article></div></div></section>
      <section id="real-code" class="cli wrap" aria-label="Real Chatwright test code"><p>Real Go, real HTTP</p><h2>One neutral scenario. Two real platforms. Zero platform-specific code.</h2><pre>// One neutral scenario — no platform-specific calls.
func greetScenario(cw *chatwright.Chatwright) {
	chat := cw.PrivateChat(chatwright.User{ID: "alice", FirstName: "Alice"})
	chat.SendText("Hi")
	chat.<b>ExpectBotMessage</b>().
		Within(time.Second).
		Text("Howdy stranger")
}

func TestGreeting(t *testing.T) {
	t.Run("<b>telegram</b>", func(t *testing.T) {
		cw := chatwright.New(t) // Telegram is the default platform
		cw.ServeWebhook(myTelegramBot(cw.BotAPIURL()))
		greetScenario(cw)
	})
	t.Run("<b>whatsapp</b>", func(t *testing.T) {
		cw := chatwright.New(t, chatwright.OnPlatform(whatsapp.Platform()))
		cw.ServeWebhook(myWhatsAppBot(cw.BotAPIURL()))
		greetScenario(cw)
	})
}</pre><pre>// Click an inline button, then assert the bot edited its own message in place.
msg.<b>ExpectAction</b>(1, 0).Label("Español").ID("lang:es").<b>Click</b>()

msg.<b>ExpectEdited</b>().
	Within(time.Second).
	Text("¡Hola, forastero!")</pre><p class="callout">Your bot can be in any language—Chatwright only speaks HTTP.</p></section>
      <section class="cli wrap"><p>Install the CLI</p><h2>Small, dependency-light, and honest about what it does today.</h2><pre><b>$</b> curl -fsSL https://chatwright.dev/install.sh | sh
<b>$</b> chatwright platforms
telegram   text, inline actions, edits
whatsapp   text (experimental)</pre></section>
      <section id="status" class="cli wrap" aria-label="Status and roadmap"><p>Status &amp; roadmap</p><h2>Deterministic evidence first—everything else builds on it.</h2><div class="steps"><article class="step"><span class="done">✅</span><div><strong>Deterministic Telegram testing</strong><p>Text, inline actions and in-place edits, driven over real HTTP webhooks—today.</p></div></article><article class="step"><span>NEXT</span><div><strong>Playground</strong><p>The same Platform Emulator becomes a first-class surface for manual, offline testing.</p></div></article><article class="step"><span>PLANNED</span><div><strong>Scenario files &amp; Starlark</strong><p>A portable, structured scenario model beyond Go test code.</p></div></article><article class="step"><span>PHASE 2</span><div><strong>AI actors</strong><p>AI personas pursue a goal instead of a script—deterministic assertions stay authoritative.</p></div></article></div></section>
    </main>
    <footer><div class="wrap"><span>An independent open-source project by Sneat.co</span><a href="https://sneat.dev/">Explore sneat.dev →</a></div></footer>
    <script>
      // Lazy-load the hero player: the iframe carries its URL in data-src and
      // only gets a real src once it is about to enter (or already is in) the
      // viewport, so the Studio bundle never competes with the landing page's
      // own first paint. IntersectionObserver still fires promptly for an
      // above-the-fold hero — this defers the fetch to the next task, not to
      // actual scroll — while keeping it truly deferred for anyone who lands
      // lower on the page first. A <noscript> iframe covers no-JS visitors.
      (function () {
        var frame = document.getElementById('hero-player');
        if (!frame) { return; }

        function loadFrame() {
          if (frame.getAttribute('src')) { return; }
          var pending = frame.getAttribute('data-src');
          if (pending) { frame.setAttribute('src', pending); }
        }

        if ('IntersectionObserver' in window) {
          var observer = new IntersectionObserver(function (entries) {
            for (var i = 0; i < entries.length; i++) {
              if (entries[i].isIntersecting) {
                loadFrame();
                observer.disconnect();
                break;
              }
            }
          }, { rootMargin: '200px' });
          observer.observe(frame);
        } else {
          loadFrame();
        }

        // Sample chips: click swaps the iframe's ?sample= param (a fresh,
        // cheap same-origin navigation — the Studio bundle is already cached
        // by the browser after the first load). Chips are also draggable so
        // the gesture reads as "this is a file" — genuine drag-and-drop
        // teaching comes from the note below plus the player's own drop
        // zone, which already accepts a *.chatwright.json dragged in from
        // your own computer (see the PR description for why a synthetic
        // in-page drag can't hand the iframe a real File the same way).
        var chips = document.querySelectorAll('.file-chip');
        for (var j = 0; j < chips.length; j++) {
          (function (chip) {
            chip.addEventListener('click', function () {
              var sample = chip.getAttribute('data-sample');
              if (!sample) { return; }
              var src = '/studio/player?embed=1&sample=' + encodeURIComponent(sample);
              frame.setAttribute('data-src', src);
              frame.setAttribute('src', src);
              for (var k = 0; k < chips.length; k++) {
                chips[k].classList.toggle('active', chips[k] === chip);
              }
            });
            chip.addEventListener('dragstart', function (event) {
              var sample = chip.getAttribute('data-sample');
              if (!sample || !event.dataTransfer) { return; }
              var url = window.location.origin + '/studio/samples/' + sample;
              event.dataTransfer.setData('text/uri-list', url);
              event.dataTransfer.setData('text/plain', url);
              event.dataTransfer.effectAllowed = 'copy';
            });
          })(chips[j]);
        }
      })();
    </script>
  </body>
</html>`;
