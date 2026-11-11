// These exact strings are rendered in the guides and exercised by the guide proof.
export const greetingTest = `package bot_test

import (
    "testing"
    "time"

    "chatwright.dev/runtime/cw"
    "chatwright.dev/runtime/examples/greetbot"
)

func TestGreeting(t *testing.T) {
    w := cw.New(t)
    bot := greetbot.New(w.BotAPIURL(), "TEST:TOKEN")
    w.ServeWebhook(bot.Handler())

    chat := w.PrivateChat(cw.User{ID: "alice", FirstName: "Alice"})
    chat.SendText("Hi")
    chat.ExpectBotMessage().Within(time.Second).Text("Howdy stranger")
}
`;

export const languageTest = `package bot_test

import (
    "testing"
    "time"

    "chatwright.dev/runtime/cw"
    "chatwright.dev/runtime/examples/greetbot"
)

func TestLanguageSelection(t *testing.T) {
    w := cw.New(t)
    bot := greetbot.New(w.BotAPIURL(), "TEST:TOKEN")
    w.ServeWebhook(bot.Handler())
    alice := w.PrivateChat(cw.User{ID: "alice", FirstName: "Alice"})

    alice.SendText("/start")
    choice := alice.ExpectBotMessage().Within(time.Second).
        Text("Choose your language")
    choice.ExpectAction(1, 0).Label("Español").ID("lang:es").Click()
    choice.ExpectEdited().Within(time.Second).Text("¡Hola, forastero!")
    alice.ExpectNoMessage(100 * time.Millisecond)

    alice.SendText("Hi again")
    alice.ExpectBotMessage().Within(time.Second).Text("¡Hola, forastero!")

    bob := w.PrivateChat(cw.User{ID: "bob", FirstName: "Bob"})
    bob.SendText("Hi")
    bob.ExpectBotMessage().Within(time.Second).Text("Howdy stranger")
}
`;

export const ciWorkflow = `name: Telegram bot regression
on: [push, pull_request]
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.27.0'
      - name: Test the bot in this repository
        shell: bash
        run: |
          mkdir -p evidence
          set -o pipefail
          go test -count=1 -timeout=60s -v ./... 2>&1 | tee evidence/go-test.txt
      - name: Install the pinned evidence-demo CLI
        run: go install chatwright.dev/cli/cmd/chatwright@v0.10.2
      - name: Run the separate bundled GreetBot evidence demo
        shell: bash
        run: |
          mkdir -p evidence/demo
          chatwright version --json > evidence/demo/version.json
          chatwright run example --out evidence/demo --json --quiet > evidence/demo/result.json
          python3 -c 'import json; r=json.load(open("evidence/demo/result.json")); assert r["partStatus"] == "completed" and r["verdict"] == "verified", r'
      - name: Preserve available evidence even on failure
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: telegram-test-evidence
          path: evidence/
          retention-days: 7
          if-no-files-found: warn
`;
