"use strict";
// ============ Uslugi sieciowe — built-in service packs ============
// DATA ONLY: ready-made API definitions (Discord, Telegram, …) offered under "From a template".
// No logic lives here; the service-pack UI reads this table and never writes to it.
//
// Entry shape: key · name · desc (one line, for the list) · verified · baseUrlHint · credential
//   · actions[{name,desc,method,path,query,headers,bodyType,body}] · guidePL · caveats
//
// TRANSPORT. A pack with `transport:"ws"` is not HTTP: it is OBS Studio over obs-websocket, and
// its actions carry `requestType` (the OBS request name) plus a JSON `body` = requestData, with
// no method, path, query or headers at all. Everything else in this table is HTTP and says
// nothing about transport, which is what "http" means. See restBuildRequest in rf-36.
//   · en{name,desc,credential,guide,caveats,actions[{name,desc}]} — the English layer.
// The `en` layer is OPTIONAL: a missing `en` or an empty string makes the UI fall back to the Polish
// original. English actions are matched to Polish ones BY INDEX, so the two arrays must stay aligned.
//
// This file must load BEFORE the module that consumes it: REST_PACKS is a top-level `const`, shared
// through the global lexical environment rather than window.
// Note the escaped "<\/" sequences inside the body templates — they are intentional and harmless;
// leave them alone.
const REST_PACKS=[
{
  "key": "discord",
  "name": "Discord — webhook",
  "desc": "Wiadomości na kanał Discorda przez webhook — bez logowania, wystarczy adres.",
  "verified": true,
  "baseUrlHint": "https://discord.com/api/webhooks",
  "credential": "Token webhooka to druga (długa) część adresu, który Discord daje przyciskiem „Kopiuj adres URL webhooka” (format: https://discord.com/api/webhooks/ID/TOKEN). Wklej sam TOKEN do sejfu RibbitFlip jako poświadczenie typu „w ścieżce” ({{secret.CREDID}}), a numeryczne ID zapisz jako zmienną {{var.DISCORD_WEBHOOK_ID}} — adres działa bez żadnego dodatkowego logowania.",
  "actions": [
    {
      "name": "Wyślij wiadomość na kanał",
      "desc": "Publikuje krótką wiadomość tekstową z etykietą wyzwalacza i aktualnym pochyleniem kapsla.",
      "method": "POST",
      "path": "/{{var.DISCORD_WEBHOOK_ID}}/{{secret.CREDID}}",
      "query": [
        [
          "wait",
          "true"
        ]
      ],
      "headers": [
        [
          "Content-Type",
          "application/json"
        ]
      ],
      "bodyType": "json",
      "body": "{\"username\":\"RibbitFlip — {{device.name}}\",\"content\":\"🐸 **{{trigger.label}}** — pochylenie {{pose.tilt}}°, obrót {{pose.twist}}°/s (#{{counter}}, {{ts.iso}})\"}"
    },
    {
      "name": "Raport telemetrii (embed)",
      "desc": "Wysyła sformatowaną kartę z kompletem odczytów czujnika: pochylenie, pitch, roll, obrót i kanały.",
      "method": "POST",
      "path": "/{{var.DISCORD_WEBHOOK_ID}}/{{secret.CREDID}}",
      "query": [
        [
          "wait",
          "true"
        ]
      ],
      "headers": [
        [
          "Content-Type",
          "application/json"
        ]
      ],
      "bodyType": "json",
      "body": "{\"username\":\"RibbitFlip\",\"embeds\":[{\"title\":\"{{trigger.label}}\",\"description\":\"Urządzenie: {{device.name}} · akcja: {{action.name}}\",\"color\":3447003,\"fields\":[{\"name\":\"Pochylenie\",\"value\":\"{{pose.tilt}}°\",\"inline\":true},{\"name\":\"Pitch / Roll\",\"value\":\"{{pose.pitch}}° / {{pose.roll}}°\",\"inline\":true},{\"name\":\"Obrót\",\"value\":\"{{pose.twist}}°/s\",\"inline\":true},{\"name\":\"Kanały\",\"value\":\"{{ch0}} · {{ch1}} · {{ch2}} · {{ch3}}\",\"inline\":false}],\"footer\":{\"text\":\"puknięcie #{{counter}}\"},\"timestamp\":\"{{ts.iso}}\"}]}"
    },
    {
      "name": "Wyślij do wybranego wątku",
      "desc": "Kieruje wiadomość do konkretnego wątku na kanale, zamiast na jego główną oś.",
      "method": "POST",
      "path": "/{{var.DISCORD_WEBHOOK_ID}}/{{secret.CREDID}}",
      "query": [
        [
          "wait",
          "true"
        ],
        [
          "thread_id",
          "{{var.DISCORD_THREAD_ID}}"
        ]
      ],
      "headers": [
        [
          "Content-Type",
          "application/json"
        ]
      ],
      "bodyType": "json",
      "body": "{\"content\":\"⏱️ {{trigger.label}} — {{ts.iso}} (tilt {{pose.tilt}}°)\"}"
    },
    {
      "name": "Cichy alert (bez powiadomienia)",
      "desc": "Wysyła wiadomość z flagą wyciszenia, więc pojawia się na kanale, ale nikogo nie pinguje.",
      "method": "POST",
      "path": "/{{var.DISCORD_WEBHOOK_ID}}/{{secret.CREDID}}",
      "query": [
        [
          "wait",
          "true"
        ]
      ],
      "headers": [
        [
          "Content-Type",
          "application/json"
        ]
      ],
      "bodyType": "json",
      "body": "{\"content\":\"🔕 {{trigger.label}} · {{device.name}} · {{ts.iso}}\",\"flags\":4096,\"allowed_mentions\":{\"parse\":[]}}"
    }
  ],
  "guidePL": "1. Otwórz Discorda na komputerze i wejdź na serwer, na którym chcesz dostawać wiadomości. Musisz mieć uprawnienie „Zarządzanie webhookami” (mają je administratorzy i właściciel serwera).\n2. Kliknij nazwę serwera u góry po lewej → „Ustawienia serwera” → w bocznym menu wybierz „Integracje”. Alternatywnie: najedź na kanał → ikona koła zębatego („Edytuj kanał”) → „Integracje”.\n3. Kliknij „Webhooki” → „Nowy webhook” (albo „Zobacz webhooki”, jeśli jakieś już istnieją, i dopiero potem „Nowy webhook”).\n4. Kliknij utworzony webhook i ustaw: nazwę (np. „RibbitFlip”), awatar oraz kanał, na który mają trafiać wiadomości. Kliknij „Zapisz zmiany” — bez tego nowy webhook może się nie zachować.\n5. Kliknij „Kopiuj adres URL webhooka”. W schowku masz adres w formacie:\nhttps://discord.com/api/webhooks/123456789012345678/AbCdEf-długi_token\n6. Rozbij ten adres na trzy części:\n   • baza: https://discord.com/api/webhooks\n   • ID: 123456789012345678 (liczby)\n   • TOKEN: AbCdEf-długi_token (reszta po ostatnim ukośniku)\n7. W RibbitFlip w polu „baseUrl” tego API wpisz: https://discord.com/api/webhooks\n8. W sejfie RibbitFlip dodaj poświadczenie typu „w ścieżce” i wklej do niego sam TOKEN. Zapamiętaj identyfikator poświadczenia — w akcjach wstawiasz go jako {{secret.CREDID}}.\n9. W zmiennych RibbitFlip dodaj {{var.DISCORD_WEBHOOK_ID}} = numeryczne ID z punktu 6. Jeśli chcesz pisać do wątku, dodaj też {{var.DISCORD_THREAD_ID}} (ID wątku: prawy przycisk na wątku → „Kopiuj identyfikator”, wymaga włączonego trybu dewelopera w Ustawieniach użytkownika → Zaawansowane).\n10. Przypisz akcję „Wyślij wiadomość na kanał” do wybranego wyzwalacza, puknij kapsel i sprawdź, czy wiadomość pojawiła się na kanale. Poprawna odpowiedź to kod 200 (przy wait=true) lub 204.",
  "caveats": "Adres webhooka jest jak hasło — kto go ma, może pisać na Twój kanał; nie udostępniaj go i trzymaj token wyłącznie w sejfie. Token nie wygasa sam, ale przestaje działać po usunięciu webhooka lub kliknięciu resetu adresu w ustawieniach kanału (wtedy zaktualizuj sejf). Limity: pole content maks. 2000 znaków, maks. 10 embedów w wiadomości; Discord ogranicza tempo wysyłek (praktycznie ok. 5 żądań na 2 sekundy na webhook i ok. 30 wiadomości na minutę na kanał — dokładne wartości nie są publikowane i zwracane są dynamicznie w nagłówkach X-RateLimit-*), przy przekroczeniu dostaniesz kod 429. Wyzwalacze reagujące na każde drgnięcie kapsla warto ograniczyć opóźnieniem, żeby nie wpaść w limit. Webhook potrafi tylko publikować na swoim kanale — nie czyta wiadomości. Usługa jest bezpłatna, konto Nitro nie jest potrzebne.",
  "en": {
    "name": "Discord — webhook",
    "desc": "Messages to a Discord channel through a webhook — no sign-in, the address is enough.",
    "credential": "The webhook token is the second (long) part of the address Discord gives you when you click \"Copy Webhook URL\" (format: https://discord.com/api/webhooks/ID/TOKEN). Paste the TOKEN alone into the RibbitFlip vault as an \"in path\" credential ({{secret.CREDID}}), and store the numeric ID as the variable {{var.DISCORD_WEBHOOK_ID}} — the address works without any additional sign-in.",
    "guide": "1. Open Discord on your computer and go to the server where you want to receive messages. You need the \"Manage Webhooks\" permission (administrators and the server owner have it).\n2. Click the server name in the top left → \"Server Settings\" → pick \"Integrations\" in the side menu. Alternatively: hover over a channel → the gear icon (\"Edit Channel\") → \"Integrations\".\n3. Click \"Webhooks\" → \"New Webhook\" (or \"View Webhooks\" if some already exist, and then \"New Webhook\").\n4. Click the webhook you created and set its name (for example \"RibbitFlip\"), avatar and the channel the messages should go to. Click \"Save Changes\" — without this the new webhook may not be kept.\n5. Click \"Copy Webhook URL\". Your clipboard now holds an address in this format:\nhttps://discord.com/api/webhooks/123456789012345678/AbCdEf-long_token\n6. Split that address into three parts:\n   • base: https://discord.com/api/webhooks\n   • ID: 123456789012345678 (the digits)\n   • TOKEN: AbCdEf-long_token (everything after the last slash)\n7. In RibbitFlip, set the \"baseUrl\" field of this app to: https://discord.com/api/webhooks\n8. In the RibbitFlip vault, add an \"in path\" credential and paste the TOKEN alone into it. Remember the credential ID — you insert it in actions as {{secret.CREDID}}.\n9. In RibbitFlip variables, add {{var.DISCORD_WEBHOOK_ID}} = the numeric ID from step 6. If you want to post into a thread, also add {{var.DISCORD_THREAD_ID}} (thread ID: right-click the thread → \"Copy ID\"; this requires Developer Mode enabled in User Settings → Advanced).\n10. Assign the \"Send a message to a channel\" action to a trigger of your choice, tap the capsule and check whether the message showed up in the channel. A correct response is status 200 (with wait=true) or 204.",
    "caveats": "The webhook URL is like a password — anyone who has it can post to your channel; never share it and keep the token in the vault only. The token does not expire on its own, but it stops working once the webhook is deleted or you click the reset-URL option in the channel settings (update the vault then). Limits: the content field is max. 2000 characters and a message can hold max. 10 embeds; Discord throttles how fast you can send (in practice about 5 requests per 2 seconds per webhook and about 30 messages per minute per channel — the exact values are not published and are returned dynamically in the X-RateLimit-* headers), and exceeding them gives you status 429. Triggers that fire on every twitch of the capsule should be given a delay so you do not hit the limit. A webhook can only post to its own channel — it cannot read messages. The service is free; a Nitro account is not needed.",
    "actions": [
      {
        "name": "Send a message to a channel",
        "desc": "Posts a short text message with the trigger label and the capsule's current tilt."
      },
      {
        "name": "Telemetry report (embed)",
        "desc": "Sends a formatted card with the full set of sensor readings: tilt, pitch, roll, twist and channels."
      },
      {
        "name": "Send to a specific thread",
        "desc": "Routes the message into a specific thread in the channel instead of the channel's main timeline."
      },
      {
        "name": "Silent alert (no notification)",
        "desc": "Sends the message with the silent flag, so it appears in the channel but pings nobody."
      }
    ]
  }
},
{
  "key": "slack",
  "name": "Slack — incoming webhook",
  "desc": "Wiadomości na kanał Slacka przez Incoming Webhook.",
  "verified": true,
  "baseUrlHint": "https://hooks.slack.com",
  "credential": "Nie ma osobnego tokenu — sekretem jest sam adres webhooka (końcówka po /services/, np. T00000000/B00000000/XXXXXXXX). Zapisz tę końcówkę w sejfie RibbitFlip jako poświadczenie typu „query/tekst” o ID np. SLACK_HOOK i wstawiaj w ścieżce jako {{secret.SLACK_HOOK}}.",
  "actions": [
    {
      "name": "Wyślij wiadomość na Slack",
      "desc": "Wysyła krótką wiadomość tekstową z etykietą wyzwalacza i czasem na kanał przypisany do webhooka.",
      "method": "POST",
      "path": "/services/{{secret.SLACK_HOOK}}",
      "query": [],
      "headers": [
        [
          "Content-Type",
          "application/json; charset=utf-8"
        ]
      ],
      "bodyType": "json",
      "body": "{\"text\": \"🐸 {{device.name}} — {{trigger.label}} ({{ts.iso}})\"}"
    },
    {
      "name": "Zgłoś pochylenie kapsla",
      "desc": "Raportuje na kanał aktualne pochylenie, pitch, roll i skręt kapsla w chwili wyzwolenia.",
      "method": "POST",
      "path": "/services/{{secret.SLACK_HOOK}}",
      "query": [],
      "headers": [
        [
          "Content-Type",
          "application/json; charset=utf-8"
        ]
      ],
      "bodyType": "json",
      "body": "{\"text\": \"*{{trigger.label}}* — pochylenie {{pose.tilt}}°, pitch {{pose.pitch}}°, roll {{pose.roll}}°, skręt {{pose.twist}}°/s\\n_{{device.name}} · {{ts.iso}}_\"}"
    },
    {
      "name": "Alarm z licznikiem",
      "desc": "Wysyła alert z numerem kolejnego zdarzenia i wartościami kanałów, przydatny do zliczania powtórzeń ruchu.",
      "method": "POST",
      "path": "/services/{{secret.SLACK_HOOK}}",
      "query": [],
      "headers": [
        [
          "Content-Type",
          "application/json; charset=utf-8"
        ]
      ],
      "bodyType": "json",
      "body": "{\"text\": \"⚠️ Alarm #{{counter}} z {{device.name}}\", \"blocks\": [{\"type\": \"section\", \"text\": {\"type\": \"mrkdwn\", \"text\": \"⚠️ *Alarm #{{counter}}* — {{trigger.label}}\\n{{device.name}} · {{ts.iso}}\"}}, {\"type\": \"context\", \"elements\": [{\"type\": \"mrkdwn\", \"text\": \"ch0 {{ch0}} · ch1 {{ch1}} · ch2 {{ch2}} · tilt {{pose.tilt}}°\"}]}]}"
    },
    {
      "name": "Notatka z własną treścią",
      "desc": "Wysyła dowolny tekst wpisany wcześniej w zmiennej RibbitFlip {{var.SLACK_TEKST}}.",
      "method": "POST",
      "path": "/services/{{secret.SLACK_HOOK}}",
      "query": [],
      "headers": [
        [
          "Content-Type",
          "application/json; charset=utf-8"
        ]
      ],
      "bodyType": "json",
      "body": "{\"text\": \"{{var.SLACK_TEKST}}\\n_(wysłane przez {{device.name}} · {{trigger.label}} · {{ts.iso}})_\"}"
    }
  ],
  "guidePL": "1. Wejdź na https://api.slack.com/apps i zaloguj się na swoje konto Slack.\n2. Kliknij „Create New App” → „From scratch”, wpisz nazwę (np. RibbitFlip) i wybierz przestrzeń roboczą (workspace), w której chcesz dostawać wiadomości.\n3. W menu po lewej wybierz „Incoming Webhooks” i przestaw przełącznik „Activate Incoming Webhooks” na „On”.\n4. Na dole strony kliknij „Add New Webhook to Workspace”, wskaż kanał (albo rozmowę z samym sobą) i zatwierdź przyciskiem „Allow”.\n5. Skopiuj adres, który się pojawi na liście „Webhook URLs for Your Workspace”. Wygląda tak: https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX\n6. Z tego adresu weź TYLKO końcówkę po „/services/”, czyli T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX.\n7. W RibbitFlip otwórz sejf poświadczeń, dodaj nowy wpis o identyfikatorze SLACK_HOOK i wklej tam tę końcówkę. Nigdy nie wklejaj jej wprost w polu adresu ani w treści wiadomości.\n8. W konfiguracji API ustaw adres bazowy (baseUrl) na https://hooks.slack.com — ścieżki akcji już zawierają /services/{{secret.SLACK_HOOK}}.\n9. Jeśli chcesz korzystać z akcji „Notatka z własną treścią”, dodaj w zmiennych RibbitFlip pozycję SLACK_TEKST i wpisz w niej swoją wiadomość.\n10. Przypisz wybraną akcję do wyzwalacza (np. przechylenie kapsla), puknij w kapsel i sprawdź, czy wiadomość pojawiła się na kanale Slack. Jeśli nie — sprawdź, czy końcówka w sejfie jest kompletna i bez spacji.",
  "caveats": "Adres webhooka JEST sekretem — kto go zna, może pisać na Twój kanał; w razie wycieku skasuj webhook w ustawieniach aplikacji i wygeneruj nowy. Jeden webhook = jeden, z góry ustalony kanał; nie da się nadpisać kanału, nazwy ani ikony z poziomu żądania (pola „channel”/„username” są ignorowane w aplikacjach Slack). Limit to około 1 wiadomość na sekundę na kanał — przy szybkich seriach ruchu Slack odpowie błędem HTTP 429, więc ustaw w wyzwalaczu odstęp (cooldown) co najmniej 1–2 s. Treść ograniczaj do ~4000 znaków. Webhook tylko wysyła — nie odczyta odpowiedzi ani nie skasuje wiadomości. Wiadomości trafiają do historii przestrzeni roboczej i mogą być widoczne dla jej administratorów, więc nie wysyłaj tam danych wrażliwych. Jeśli treść zawiera polskie znaki, zostaw nagłówek Content-Type z „charset=utf-8”.",
  "en": {
    "name": "Slack — incoming webhook",
    "desc": "Messages to a Slack channel through an Incoming Webhook.",
    "credential": "There is no separate token — the webhook URL itself is the secret (the part after /services/, for example T00000000/B00000000/XXXXXXXX). Store that tail in the RibbitFlip vault as a \"query/text\" credential with an ID such as SLACK_HOOK and insert it in the path as {{secret.SLACK_HOOK}}.",
    "guide": "1. Go to https://api.slack.com/apps and sign in to your Slack account.\n2. Click \"Create New App\" → \"From scratch\", type a name (for example RibbitFlip) and choose the workspace where you want to receive the messages.\n3. In the left-hand menu pick \"Incoming Webhooks\" and flip the \"Activate Incoming Webhooks\" switch to \"On\".\n4. At the bottom of the page click \"Add New Webhook to Workspace\", pick a channel (or a chat with yourself) and confirm with \"Allow\".\n5. Copy the address that appears in the \"Webhook URLs for Your Workspace\" list. It looks like this: https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX\n6. From that address take ONLY the tail after \"/services/\", that is T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX.\n7. In RibbitFlip open the credential vault, add a new entry with the ID SLACK_HOOK and paste that tail into it. Never paste it directly into the address field or into a message body.\n8. In the app configuration set the base address (baseUrl) to https://hooks.slack.com — the action paths already contain /services/{{secret.SLACK_HOOK}}.\n9. If you want to use the \"Note with your own text\" action, add a RibbitFlip variable named SLACK_TEKST and type your message into it.\n10. Assign the action you picked to a trigger (for example tilting the capsule), tap the capsule and check whether the message showed up in the Slack channel. If it did not — check that the tail in the vault is complete and has no spaces.",
    "caveats": "The webhook URL IS the secret — anyone who knows it can post to your channel; if it leaks, delete the webhook in the app settings and generate a new one. One webhook = one channel fixed up front; you cannot override the channel, username or icon from the request (the \"channel\"/\"username\" fields are ignored for Slack apps). The limit is about 1 message per second per channel — during fast bursts of movement Slack will answer with HTTP 429, so set a cooldown of at least 1–2 s on the trigger. Keep the text under roughly 4000 characters. A webhook only sends — it cannot read a reply or delete a message. Messages land in the workspace history and may be visible to its administrators, so do not send sensitive data there. If your text contains non-English characters, keep the Content-Type header with \"charset=utf-8\".",
    "actions": [
      {
        "name": "Send a message to Slack",
        "desc": "Sends a short text message with the trigger label and the time to the channel bound to the webhook."
      },
      {
        "name": "Report the capsule's tilt",
        "desc": "Reports the capsule's current tilt, pitch, roll and twist at the moment the trigger fired."
      },
      {
        "name": "Alert with a counter",
        "desc": "Sends an alert with the sequence number of the event and the channel values — handy for counting repeated movements."
      },
      {
        "name": "Note with your own text",
        "desc": "Sends any text you typed earlier into the RibbitFlip variable {{var.SLACK_TEKST}}."
      }
    ]
  }
},
{
  "key": "ntfy",
  "needsCred": false,
  "name": "ntfy.sh — push na telefon",
  "desc": "Push na telefon przez ntfy.sh — za darmo i bez zakładania konta.",
  "verified": true,
  "baseUrlHint": "https://ntfy.sh",
  "credential": "Zwykle BRAK — publiczny serwis ntfy.sh nie wymaga konta ani klucza, wystarczy trudny do odgadnięcia temat (traktuj nazwę tematu jak hasło). Jeśli chcesz temat chroniony, załóż konto na ntfy.sh, w Account → Access tokens wygeneruj token 'tk_…' i dodaj go w sejfie RibbitFlip jako poświadczenie typu bearer (poleci nagłówek Authorization: Bearer tk_…).",
  "actions": [
    {
      "name": "Powiadomienie o puknięciu",
      "desc": "Wysyła na telefon powiadomienie z nazwą wyzwalacza, pochyleniem kapsla i godziną.",
      "method": "POST",
      "path": "/",
      "query": [],
      "headers": [
        [
          "Content-Type",
          "application/json"
        ]
      ],
      "bodyType": "json",
      "body": "{\"topic\":\"{{var.NTFY_TOPIC}}\",\"title\":\"RibbitFlip: {{trigger.label}}\",\"message\":\"Kapsel {{device.name}} — pochylenie {{pose.tilt}}°, obrót {{pose.twist}}°/s\\nCzas: {{ts.iso}}\",\"priority\":3,\"tags\":[\"frog\"]}"
    },
    {
      "name": "Alarm pilny",
      "desc": "Powiadomienie o najwyższym priorytecie (5) z czerwoną syreną — przebija tryb cichy na telefonie.",
      "method": "POST",
      "path": "/",
      "query": [],
      "headers": [
        [
          "Content-Type",
          "application/json"
        ]
      ],
      "bodyType": "json",
      "body": "{\"topic\":\"{{var.NTFY_TOPIC}}\",\"title\":\"ALARM — {{trigger.label}}\",\"message\":\"Wyzwalacz {{trigger.label}} zadziałał na urządzeniu {{device.name}}.\\nPochylenie {{pose.tilt}}°, pitch {{pose.pitch}}°, roll {{pose.roll}}°\",\"priority\":5,\"tags\":[\"rotating_light\"]}"
    },
    {
      "name": "Cichy log zdarzenia",
      "desc": "Zapisuje zdarzenie w temacie z priorytetem 1 (bez dźwięku i wibracji) — do przeglądania historii w aplikacji.",
      "method": "POST",
      "path": "/",
      "query": [],
      "headers": [
        [
          "Content-Type",
          "application/json"
        ]
      ],
      "bodyType": "json",
      "body": "{\"topic\":\"{{var.NTFY_TOPIC}}\",\"title\":\"Log: {{action.name}}\",\"message\":\"#{{counter}} {{trigger.label}} | ch0={{ch0}} ch1={{ch1}} ch2={{ch2}} | {{ts.unix}}\",\"priority\":1,\"tags\":[\"memo\"]}"
    },
    {
      "name": "Szybki tekst (nagłówki)",
      "desc": "Najprostsza wersja — treść w ciele żądania, tytuł i priorytet w nagłówkach HTTP.",
      "method": "POST",
      "path": "/{{var.NTFY_TOPIC}}",
      "query": [],
      "headers": [
        [
          "Content-Type",
          "text/plain; charset=utf-8"
        ],
        [
          "Title",
          "RibbitFlip"
        ],
        [
          "Priority",
          "4"
        ],
        [
          "Tags",
          "frog,bell"
        ]
      ],
      "bodyType": "text",
      "body": "{{trigger.label}} — pochylenie {{pose.tilt}} st., {{ts.iso}}"
    }
  ],
  "guidePL": "1. Zainstaluj aplikację „ntfy” na telefonie: Android — Google Play lub F-Droid, iPhone — App Store (szukaj: ntfy). Konto NIE jest potrzebne.\n2. Wymyśl własną nazwę tematu (ang. topic). Nazwa tematu działa jak hasło — musi być długa i nieodgadywalna, np. `ribbitflip-kapsel-7fk92xq`. Dozwolone są litery, cyfry, podkreślnik i myślnik (do 64 znaków).\n3. W aplikacji ntfy na telefonie naciśnij „+” (Subscribe to topic), wpisz DOKŁADNIE tę samą nazwę tematu, zostaw serwer domyślny `ntfy.sh` i zatwierdź. Od tej chwili telefon nasłuchuje.\n4. W RibbitFlip dodaj nowe API z tego szablonu. W polu adresu bazowego (baseUrl) ma być: `https://ntfy.sh`.\n5. W sekcji zmiennych RibbitFlip dodaj zmienną o nazwie `NTFY_TOPIC` i wklej w nią swoją nazwę tematu z kroku 2 (bez adresu, samą nazwę). Wszystkie akcje szablonu jej używają.\n6. Sejf poświadczeń zostaw pusty — publiczne tematy ntfy.sh nie wymagają żadnego klucza.\n7. Kliknij „Testuj” przy akcji „Powiadomienie o puknięciu”. W ciągu 1–2 sekund powiadomienie powinno pojawić się na telefonie. Poprawna odpowiedź serwera to kod 200.\n8. Podepnij akcję pod wybrany wyzwalacz kapsla (np. mocne puknięcie albo przekroczenie pochylenia) i sprawdź na żywo.\n9. Jeśli powiadomienie nie dociera: sprawdź literówkę w temacie (musi być identyczny w telefonie i w zmiennej `NTFY_TOPIC`) oraz czy Android nie uśpił aplikacji ntfy w ustawieniach baterii (ustaw „Bez ograniczeń”).\n10. Opcjonalnie (temat prywatny): załóż konto na https://ntfy.sh, w Account → Access tokens wygeneruj token `tk_…`, ustaw na koncie prawa dostępu do tematu, a token dodaj w sejfie RibbitFlip jako poświadczenie typu „bearer”. W telefonie w ustawieniach subskrypcji podaj ten sam login/token.",
  "caveats": "Temat na publicznym ntfy.sh jest DOSTĘPNY DLA KAŻDEGO, kto zna jego nazwę — każdy może czytać i wysyłać do niego wiadomości. Nie wysyłaj tam danych wrażliwych i używaj długiej, losowej nazwy tematu. Limity: wiadomość do 4096 bajtów, załączniki do 15 MB (100 MB na użytkownika, kasowane po 3 godzinach); darmowy serwis ma też niepublikowane limity zapytań na godzinę — przy bardzo częstych wyzwalaczach możliwy kod 429 (za dużo żądań), więc dodaj odstęp między wysyłkami. Polskie znaki w NAGŁÓWKACH (Title/Tags) bywają przekłamywane — dlatego akcje z polskimi tekstami używają wariantu JSON (POST na `/`), a nie nagłówków. Tokeny `tk_…` (jeśli ich użyjesz) mogą mieć ustawioną datę wygaśnięcia — wtedy trzeba je odnowić w panelu konta.",
  "en": {
    "name": "ntfy.sh — push to your phone",
    "desc": "Push to your phone through ntfy.sh — free and with no account.",
    "credential": "Usually NONE — the public ntfy.sh service needs no account and no key, all you need is a topic name that is hard to guess (treat the topic name like a password). If you want a protected topic, create an account on ntfy.sh, generate a 'tk_…' token under Account → Access tokens and add it to the RibbitFlip vault as a bearer credential (it will be sent as the header Authorization: Bearer tk_…).",
    "guide": "1. Install the \"ntfy\" app on your phone: Android — Google Play or F-Droid, iPhone — App Store (search for: ntfy). An account is NOT needed.\n2. Make up your own topic name. The topic name works like a password — it must be long and impossible to guess, for example `ribbitflip-capsule-7fk92xq`. Letters, digits, underscore and hyphen are allowed (up to 64 characters).\n3. In the ntfy app on your phone tap \"+\" (Subscribe to topic), type EXACTLY the same topic name, leave the default server `ntfy.sh` and confirm. From now on your phone is listening.\n4. In RibbitFlip add a new app from this template. The base address (baseUrl) must be: `https://ntfy.sh`.\n5. In the RibbitFlip variables section add a variable named `NTFY_TOPIC` and paste your topic name from step 2 into it (just the name, not the address). Every action in this template uses it.\n6. Leave the credential vault empty — public ntfy.sh topics need no key at all.\n7. Click \"Test\" on the \"Tap notification\" action. Within 1–2 seconds the notification should appear on your phone. A correct server response is status 200.\n8. Hook the action up to a capsule trigger of your choice (for example a hard tap or exceeding a tilt threshold) and check it live.\n9. If the notification does not arrive: check the topic for typos (it must be identical on the phone and in the `NTFY_TOPIC` variable) and check that Android has not put the ntfy app to sleep in the battery settings (set it to \"Unrestricted\").\n10. Optional (private topic): create an account at https://ntfy.sh, generate a `tk_…` token under Account → Access tokens, grant that account access rights to the topic, and add the token to the RibbitFlip vault as a \"bearer\" credential. On the phone, enter the same login/token in the subscription settings.",
    "caveats": "A topic on the public ntfy.sh is AVAILABLE TO ANYONE who knows its name — anybody can read it and post to it. Do not send sensitive data there and use a long, random topic name. Limits: messages up to 4096 bytes, attachments up to 15 MB (100 MB per user, deleted after 3 hours); the free service also has unpublished per-hour request limits — with very frequent triggers you may get status 429 (too many requests), so put a delay between sends. Non-English characters in HEADERS (Title/Tags) are sometimes mangled — that is why the actions with non-ASCII text use the JSON variant (POST to `/`) instead of headers. `tk_…` tokens (if you use them) can have an expiry date set — you then have to renew them in your account panel.",
    "actions": [
      {
        "name": "Tap notification",
        "desc": "Sends a notification to your phone with the trigger name, the capsule's tilt and the time."
      },
      {
        "name": "Urgent alarm",
        "desc": "A top-priority (5) notification with a red siren — it breaks through silent mode on the phone."
      },
      {
        "name": "Silent event log",
        "desc": "Records the event in the topic with priority 1 (no sound, no vibration) — for browsing the history in the app."
      },
      {
        "name": "Quick text (headers)",
        "desc": "The simplest version — the text goes in the request body, the title and priority in HTTP headers."
      }
    ]
  }
},
{
  "key": "n8n",
  "name": "n8n — webhook",
  "desc": "Webhook do własnego przepływu n8n (albo dowolnego serwera przyjmującego JSON).",
  "verified": true,
  "baseUrlHint": "http://localhost:5678",
  "credential": "Zwykle poświadczenie typu „header” — w węźle Webhook ustaw Authentication = Header Auth i utwórz credential z własną nazwą nagłówka (np. X-RF-Token) oraz sekretną wartością; tę samą wartość zapisz w sejfie RibbitFlip. Jeśli webhook jest bez autoryzacji — wpisz „brak” (wtedy chroni tylko długa, losowa ścieżka).",
  "actions": [
    {
      "name": "Wyślij zdarzenie wyzwalacza (produkcja)",
      "desc": "Wysyła pełną telemetrię ruchu kapsla do produkcyjnego adresu webhooka aktywnego workflow n8n.",
      "method": "POST",
      "path": "/webhook/{{var.N8N_PATH}}",
      "query": [],
      "headers": [
        [
          "Content-Type",
          "application/json"
        ]
      ],
      "bodyType": "json",
      "body": "{\"trigger\":\"{{trigger.label}}\",\"device\":\"{{device.name}}\",\"ts\":\"{{ts.iso}}\",\"tsUnix\":{{ts.unix}},\"counter\":{{counter}},\"pose\":{\"tilt\":{{pose.tilt}},\"pitch\":{{pose.pitch}},\"roll\":{{pose.roll}},\"twist\":{{pose.twist}}},\"ch\":[{{ch0}},{{ch1}},{{ch2}},{{ch3}},{{ch4}},{{ch5}}]}"
    },
    {
      "name": "Wyślij zdarzenie do testowego URL",
      "desc": "To samo zdarzenie, ale na adres testowy — działa tylko gdy w edytorze n8n klikniesz „Listen for test event”.",
      "method": "POST",
      "path": "/webhook-test/{{var.N8N_PATH}}",
      "query": [],
      "headers": [
        [
          "Content-Type",
          "application/json"
        ]
      ],
      "bodyType": "json",
      "body": "{\"trigger\":\"{{trigger.label}}\",\"device\":\"{{device.name}}\",\"ts\":\"{{ts.iso}}\",\"pose\":{\"tilt\":{{pose.tilt}},\"pitch\":{{pose.pitch}},\"roll\":{{pose.roll}},\"twist\":{{pose.twist}}}}"
    },
    {
      "name": "Szybki ping (GET)",
      "desc": "Lekkie wywołanie webhooka metodą GET z parametrami w adresie — dla workflow, w którym w węźle Webhook wybrano metodę GET.",
      "method": "GET",
      "path": "/webhook/{{var.N8N_PATH}}",
      "query": [
        [
          "trigger",
          "{{trigger.label}}"
        ],
        [
          "tilt",
          "{{pose.tilt}}"
        ],
        [
          "twist",
          "{{pose.twist}}"
        ],
        [
          "ts",
          "{{ts.iso}}"
        ]
      ],
      "headers": [],
      "bodyType": "none",
      "body": ""
    }
  ],
  "guidePL": "1. Otwórz swój n8n (self-host domyślnie pod http://localhost:5678, w chmurze — Twój adres instancji) i utwórz nowy workflow.\n2. Dodaj węzeł startowy „Webhook”. W polu „HTTP Method” wybierz POST (dla akcji „Szybki ping” — GET). W polu „Path” wpisz własną, długą i trudną do zgadnięcia ścieżkę, np. ribbitflip-8f2a91.\n3. Skopiuj tę ścieżkę i wklej ją w RibbitFlip jako zmienną {{var.N8N_PATH}} (bez ukośnika na początku).\n4. W RibbitFlip w polu baseUrl wpisz adres swojej instancji n8n, np. http://localhost:5678 (bez ukośnika na końcu). Jeśli n8n stoi na innym komputerze w sieci — użyj jego adresu IP i portu.\n5. Zabezpiecz webhook: w węźle Webhook ustaw „Authentication” na „Header Auth”, kliknij „Create new credential”, wpisz nazwę nagłówka (np. X-RF-Token) i wymyśloną, długą wartość-hasło. Zapisz.\n6. W RibbitFlip dodaj do sejfu poświadczenie typu „header” — nazwa nagłówka taka sama jak w n8n, wartość taka sama jak hasło z kroku 5. Następnie przypisz to poświadczenie do tego API.\n7. Test: w n8n kliknij „Listen for test event”, a w RibbitFlip uruchom akcję „Wyślij zdarzenie do testowego URL”. Dane powinny pojawić się w węźle Webhook w edytorze.\n8. Gdy działa — zapisz workflow i przełącz go na „Active” (przełącznik w prawym górnym rogu). Dopiero wtedy zadziała adres produkcyjny /webhook/...\n9. Na co dzień używaj akcji „Wyślij zdarzenie wyzwalacza (produkcja)”. Efekty zobaczysz w zakładce „Executions” workflow — adres produkcyjny nie pokazuje danych w edytorze.\n10. Dalsze węzły w workflow (np. Slack, e-mail, arkusz) odbiorą pola: trigger, device, ts, pose.tilt, pose.twist itd.",
  "caveats": "Adres produkcyjny /webhook/... zwraca 404, dopóki workflow nie jest aktywny — to normalne zachowanie, nie błąd RibbitFlip. Adres testowy /webhook-test/... działa tylko przez chwilę po kliknięciu „Listen for test event” i tylko dla jednego wywołania. Ścieżkę („Path”) wymyślasz od zera — nie ma jednego uniwersalnego endpointu, dlatego wpisz ją w zmienną. Uważaj na ukośnik na końcu: /webhook/moja-sciezka i /webhook/moja-sciezka/ to dla n8n różne adresy. Maksymalny rozmiar żądania to 16 MB. Jeśli n8n działa lokalnie (localhost), aplikacja musi być w tej samej sieci co serwer. Bez włączonej autoryzacji każdy, kto zna adres, może uruchomić Twój workflow — zawsze ustawiaj Header Auth i/lub listę dozwolonych IP. n8n Cloud rozlicza wykonania workflow, więc częste wyzwalanie ruchem kapsla może szybko zużyć limit planu.",
  "en": {
    "name": "n8n — webhook",
    "desc": "A webhook into your own n8n flow (or any server that accepts JSON).",
    "credential": "Usually a \"header\" credential — in the Webhook node set Authentication = Header Auth and create a credential with your own header name (e.g. X-RF-Token) and a secret value; store that same value in the RibbitFlip vault. If the webhook has no authentication, enter \"none\" (only the long, random path protects it then).",
    "guide": "1. Open your n8n (self-hosted: http://localhost:5678 by default; cloud: your instance address) and create a new workflow.\n2. Add the \"Webhook\" trigger node. Set \"HTTP Method\" to POST (for the \"Quick ping\" action — GET). In \"Path\", enter your own long, hard-to-guess path, e.g. ribbitflip-8f2a91.\n3. Copy that path and paste it into RibbitFlip as the variable {{var.N8N_PATH}} (no leading slash).\n4. In RibbitFlip, set baseUrl to your n8n instance address, e.g. http://localhost:5678 (no trailing slash). If n8n runs on another computer on your network, use its IP address and port.\n5. Secure the webhook: in the Webhook node set \"Authentication\" to \"Header Auth\", click \"Create new credential\", enter a header name (e.g. X-RF-Token) and a long password-like value of your own. Save.\n6. In RibbitFlip, add a \"header\" credential to the vault — the same header name as in n8n and the same value as the password from step 5. Then assign that credential to this app.\n7. Test: in n8n click \"Listen for test event\", then run the \"Send event to test URL\" action in RibbitFlip. The data should show up in the Webhook node in the editor.\n8. Once it works, save the workflow and switch it to \"Active\" (toggle in the top right). Only then does the production address /webhook/... work.\n9. For everyday use, run the \"Send trigger event (production)\" action. You will see the results in the workflow's \"Executions\" tab — the production address does not show data in the editor.\n10. The following nodes in your workflow (Slack, email, a spreadsheet, etc.) will receive the fields: trigger, device, ts, pose.tilt, pose.twist and so on.",
    "caveats": "The production address /webhook/... returns 404 until the workflow is active — that is normal n8n behaviour, not a RibbitFlip error. The test address /webhook-test/... only works for a short moment after you click \"Listen for test event\", and only for a single call. The \"Path\" is entirely yours — there is no universal endpoint, which is why you put it in a variable. Watch the trailing slash: /webhook/my-path and /webhook/my-path/ are different addresses for n8n. The maximum request size is 16 MB. If n8n runs locally (localhost), the app must be on the same network as the server. Without authentication enabled, anyone who knows the address can run your workflow — always set up Header Auth and/or an IP allowlist. n8n Cloud bills you per workflow execution, so triggering frequently with capsule motion can burn through your plan's quota fast.",
    "actions": [
      {
        "name": "Send trigger event (production)",
        "desc": "Sends the full capsule motion telemetry to the production webhook URL of an active n8n workflow."
      },
      {
        "name": "Send event to test URL",
        "desc": "The same event, but to the test URL — works only while \"Listen for test event\" is active in the n8n editor."
      },
      {
        "name": "Quick ping (GET)",
        "desc": "A lightweight GET call to the webhook with parameters in the URL — for workflows whose Webhook node is set to the GET method."
      }
    ]
  }
},
{
  "key": "make",
  "name": "Make.com — webhook scenariusza",
  "desc": "Uruchamia scenariusz Make (dawny Integromat) — jeden adres, a dalej Twoja automatyzacja.",
  "verified": true,
  "baseUrlHint": "https://hook.eu2.make.com",
  "credential": "Poświadczenie typu „własny nagłówek” o nazwie x-make-apikey — tak Make chroni webhook kluczem API. Klucz tworzysz w ustawieniach webhooka przyciskiem „+ Add API key”; po zapisaniu Make już go nie pokaże, więc od razu wklej go do sejfu RibbitFlip. Sam identyfikator webhooka nie jest poświadczeniem — trzymasz go w zmiennej {{var.MAKE_HOOK_ID}}. Jeśli nie włączasz klucza API, wpisz „brak”: wtedy scenariusza pilnuje wyłącznie sekretność adresu i ewentualna lista dozwolonych IP.",
  "actions": [
    {
      "name": "Uruchom scenariusz (pełna telemetria)",
      "desc": "Wysyła komplet danych o wyzwoleniu — z tego żądania Make uczy się struktury danych.",
      "method": "POST",
      "path": "/{{var.MAKE_HOOK_ID}}",
      "query": [],
      "headers": [
        [
          "Content-Type",
          "application/json"
        ]
      ],
      "bodyType": "json",
      "body": "{\"trigger\":{\"label\":\"{{trigger.label}}\",\"key\":\"{{trigger.key}}\",\"fires\":\"{{trigger.fires}}\"},\"device\":{\"id\":\"{{device.id}}\",\"name\":\"{{device.name}}\"},\"action\":\"{{action.name}}\",\"ts\":\"{{ts.iso}}\",\"tsUnix\":{{ts.unix}},\"counter\":{{counter}},\"pose\":{\"tilt\":{{pose.tilt}},\"pitch\":{{pose.pitch}},\"roll\":{{pose.roll}},\"twist\":{{pose.twist}}},\"ch\":[{{ch0}},{{ch1}},{{ch2}},{{ch3}},{{ch4}},{{ch5}}]}"
    },
    {
      "name": "Zdarzenie zwięzłe (płaskie pola)",
      "desc": "Sześć pól bez zagnieżdżeń — w scenariuszu mapujesz je od razu, bez wchodzenia w kolekcje.",
      "method": "POST",
      "path": "/{{var.MAKE_HOOK_ID}}",
      "query": [],
      "headers": [
        [
          "Content-Type",
          "application/json"
        ]
      ],
      "bodyType": "json",
      "body": "{\"trigger\":\"{{trigger.label}}\",\"device\":\"{{device.name}}\",\"tilt\":{{pose.tilt}},\"twist\":{{pose.twist}},\"ts\":\"{{ts.iso}}\",\"counter\":{{counter}}}"
    },
    {
      "name": "Szybki ping (GET)",
      "desc": "Wywołanie GET z parametrami w adresie — dla scenariuszy, którym wystarczy sam sygnał z kilkoma liczbami.",
      "method": "GET",
      "path": "/{{var.MAKE_HOOK_ID}}",
      "query": [
        [
          "trigger",
          "{{trigger.label}}"
        ],
        [
          "tilt",
          "{{pose.tilt}}"
        ],
        [
          "twist",
          "{{pose.twist}}"
        ],
        [
          "ts",
          "{{ts.iso}}"
        ]
      ],
      "headers": [],
      "bodyType": "none",
      "body": ""
    },
    {
      "name": "Wyślij i odczytaj odpowiedź scenariusza",
      "desc": "To samo zdarzenie, ale z prośbą o odpowiedź JSON — treść z modułu „Webhook response” zobaczysz w dzienniku wysyłek.",
      "method": "POST",
      "path": "/{{var.MAKE_HOOK_ID}}",
      "query": [],
      "headers": [
        [
          "Content-Type",
          "application/json"
        ],
        [
          "Accept",
          "application/json"
        ]
      ],
      "bodyType": "json",
      "body": "{\"trigger\":\"{{trigger.label}}\",\"device\":\"{{device.name}}\",\"tilt\":{{pose.tilt}},\"ts\":\"{{ts.iso}}\",\"wantsReply\":true}"
    }
  ],
  "guidePL": "1. Zaloguj się na make.com i kliknij „Create a new scenario”. Otworzy się pusty edytor scenariusza.\n2. Kliknij duże kółko z „+” na środku, wpisz w wyszukiwarce „Webhooks”, wybierz aplikację Webhooks, a z jej listy wyzwalacz „Custom webhook”.\n3. W module kliknij „Create a webhook”, nadaj nazwę (np. „RibbitFlip”) i zapisz przyciskiem „Save”.\n4. Make pokaże adres webhooka — kliknij „Copy address to clipboard”. Adres wygląda tak:\nhttps://hook.eu2.make.com/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\n5. Rozbij ten adres na dwie części:\n   • baza: https://hook.eu2.make.com — uwaga, strefa Twojego konta może być inna (eu1, us1, us2); przepisz dokładnie to, co pokazał Make,\n   • identyfikator: ciąg znaków po ostatnim ukośniku.\n6. W RibbitFlip w polu „Adres bazowy” tej aplikacji wpisz bazę z punktu 5 (bez ukośnika na końcu). Identyfikator dodaj w karcie „Zmienne” pod nazwą MAKE_HOOK_ID — akcje sięgają po niego tokenem {{var.MAKE_HOOK_ID}}.\n7. Zalecane zabezpieczenie kluczem API: w Make otwórz ustawienia tego webhooka (przycisk „Edit” przy wybranym webhooku w module albo sekcja „Webhooks” w lewym menu → menu trzech kropek → „Edit”), rozwiń zaawansowane ustawienia i kliknij „+ Add API key”. Nadaj nazwę pęku kluczy i wpisz własny, długi klucz (do 512 znaków ASCII). Zapisz — po zapisaniu Make nie pokaże już wartości klucza, więc od razu przenieś ją do RibbitFlip.\n8. W RibbitFlip kliknij „Ustaw hasło sejfu”, potem „Dodaj poświadczenie” typu „własny nagłówek”: nazwa nagłówka x-make-apikey, wartość — klucz z punktu 7. W pod-zakładce „Ustawienia i test” przypisz to poświadczenie do tej aplikacji.\n9. Wróć do Make — moduł webhooka czeka z komunikatem „Determine data structure”. W RibbitFlip kliknij „▶ Wyślij” przy akcji „Uruchom scenariusz (pełna telemetria)”. Make odpowie „Successfully determined” i zapamięta wszystkie pola, więc dalsze moduły będą je miały gotowe do mapowania.\n10. Dołóż kolejne moduły scenariusza (e-mail, Arkusze Google, Slack, cokolwiek), mapując pola trigger.label, device.name, pose.tilt, ts. Zapisz scenariusz i włącz go przełącznikiem ON na dolnym pasku edytora — przy wyłączonym scenariuszu dane tylko czekają w kolejce. Na koniec w RibbitFlip podepnij akcję pod wyzwalacz: pod-zakładka „Wyzwalacze” → „Dodaj wyzwalacz” i włącz „Wysyłka automatyczna”. Poprawna odpowiedź webhooka to kod 200 z treścią „Accepted”.",
  "caveats": "Adres webhooka jest jak hasło — kto go zna, uruchamia Twój scenariusz i zużywa Twoje operacje. Dlatego warto włączyć klucz API (nagłówek x-make-apikey) albo listę dozwolonych adresów IP (pole przyjmuje adresy po przecinku, także w notacji CIDR). Nagłówek x-make-apikey jest u Make zastrzeżony: nie zobaczysz go w danych nagłówków przekazywanych do scenariusza, bo jest z nich usuwany. Odpowiedź 200 „Accepted” znaczy tylko „przyjęto do kolejki”, a nie „scenariusz się udał” — własną odpowiedź (kod, treść, nagłówki) daje dopiero moduł „Webhook response” na końcu scenariusza. Dane zawsze trafiają najpierw do kolejki webhooka i czekają tam na przetworzenie; przy wyłączonym scenariuszu kolejka rośnie, a gdy się zapełni, Make odrzuca nadmiar odpowiedzią 400 „Queue is full”. Pojemność kolejki zależy od planu — na koncie Free to 50 pozycji na webhook; Make skaluje ją z liczbą kredytów, maksymalnie do 10 000 pozycji. Przy zbyt gęstym ruchu dostaniesz 429 „Too many requests”, dlatego wyzwalacz reagujący na każde drgnięcie kapsla ustaw z opóźnieniem albo na wyraźnym progu. Maksymalny rozmiar żądania to 5 MB (Content-Length 5 242 880 bajtów) — telemetria kapsla jest od tego o rzędy wielkości mniejsza. Jeśli webhook ma zdefiniowaną strukturę danych, żądania, które jej nie spełniają, są odrzucane z kodem 400 — po zmianie treści akcji kliknij w Make „Redetermine data structure”. Każde uruchomienie scenariusza zużywa operacje z planu, więc częste puknięcia kapslem potrafią zjeść miesięczny limit. Make łączy dane z adresu i z treści w jeden pakiet, a przy powtórzonej nazwie pola wygrywa parametr z adresu.",
  "en": {
    "name": "Make.com — scenario webhook",
    "desc": "Runs a Make (formerly Integromat) scenario — one address, and the automation takes it from there.",
    "credential": "A \"custom header\" credential named x-make-apikey — that is how Make protects a webhook with an API key. You create the key in the webhook settings with \"+ Add API key\"; once saved, Make never shows it again, so paste it into the RibbitFlip vault right away. The webhook identifier itself is not a credential — it lives in the {{var.MAKE_HOOK_ID}} variable. If you do not enable an API key, enter \"none\": the scenario is then guarded only by the secrecy of the address and, optionally, an allowed-IP list.",
    "guide": "1. Sign in at make.com and click \"Create a new scenario\". An empty scenario editor opens.\n2. Click the large \"+\" circle in the middle, type \"Webhooks\" in the search box, pick the Webhooks app and then its \"Custom webhook\" trigger.\n3. In the module click \"Create a webhook\", give it a name (for example \"RibbitFlip\") and click \"Save\".\n4. Make shows the webhook address — click \"Copy address to clipboard\". The address looks like this:\nhttps://hook.eu2.make.com/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\n5. Split that address into two parts:\n   • base: https://hook.eu2.make.com — note that your account may sit in a different zone (eu1, us1, us2); copy exactly what Make showed you,\n   • identifier: everything after the last slash.\n6. In RibbitFlip, set this application's \"Base address\" to the base from step 5 (no trailing slash). Add the identifier in the \"Variables\" card as MAKE_HOOK_ID — the actions read it through {{var.MAKE_HOOK_ID}}.\n7. Recommended protection, an API key: in Make open this webhook's settings (the \"Edit\" button next to the selected webhook in the module, or the \"Webhooks\" section in the left menu → three-dot menu → \"Edit\"), expand the advanced settings and click \"+ Add API key\". Name the keychain and enter your own long key (up to 512 ASCII characters). Save — Make will not show the key value again, so move it into RibbitFlip right away.\n8. In RibbitFlip click \"Set vault password\", then \"Add credential\" of the \"custom header\" type: header name x-make-apikey, value — the key from step 7. In the \"Settings & test\" sub-tab, assign that credential to this application.\n9. Go back to Make — the webhook module is waiting with \"Determine data structure\". In RibbitFlip click \"▶ Send\" next to the \"Run the scenario (full telemetry)\" action. Make answers \"Successfully determined\" and remembers every field, so the following modules have them ready for mapping.\n10. Add the rest of the scenario (email, Google Sheets, Slack, whatever), mapping the fields trigger.label, device.name, pose.tilt, ts. Save the scenario and switch it ON with the toggle on the editor's bottom bar — while the scenario is off, the data only waits in the queue. Finally, in RibbitFlip attach the action to a trigger: the \"Triggers\" sub-tab → \"Add trigger\", and turn on \"Automatic sending\". A correct webhook response is status 200 with the body \"Accepted\".",
    "caveats": "The webhook address is like a password — anyone who knows it can run your scenario and spend your operations. That is why it is worth enabling an API key (the x-make-apikey header) or an allowed-IP list (the field takes comma-separated addresses, CIDR notation included). The x-make-apikey header is reserved in Make: you will not see it among the request headers passed into the scenario, because it is stripped from them. A 200 \"Accepted\" response only means \"queued\", not \"the scenario succeeded\" — a response of your own (status, body, headers) comes from the \"Webhook response\" module at the end of the scenario. Data always lands in the webhook's queue first and waits there to be processed; while the scenario is off the queue grows, and once it is full Make rejects the surplus with 400 \"Queue is full\". Queue capacity depends on your plan — 50 items per webhook on a Free account; Make scales it with your credits, up to a maximum of 10,000 items. Traffic that is too dense earns a 429 \"Too many requests\", so give a trigger that fires on every twitch of the capsule a delay or a firm threshold. The maximum request size is 5 MB (Content-Length 5,242,880 bytes) — capsule telemetry is orders of magnitude smaller. If the webhook has a data structure defined, requests that do not match it are rejected with status 400 — after changing an action's body, click \"Redetermine data structure\" in Make. Every scenario run consumes operations from your plan, so frequent capsule taps can eat through the monthly quota. Make merges data from the address and from the body into a single bundle, and on a duplicated field name the query-string parameter wins.",
    "actions": [
      {
        "name": "Run the scenario (full telemetry)",
        "desc": "Sends the complete trigger data — this is the request Make learns the data structure from."
      },
      {
        "name": "Compact event (flat fields)",
        "desc": "Six fields with no nesting — you map them straight away in the scenario, without opening collections."
      },
      {
        "name": "Quick ping (GET)",
        "desc": "A GET call with parameters in the address — for scenarios that only need the signal and a few numbers."
      },
      {
        "name": "Send and read the scenario's reply",
        "desc": "The same event, but asking for a JSON reply — the body from the \"Webhook response\" module shows up in the send log."
      }
    ]
  }
},
{
  "key": "ifttt",
  "name": "IFTTT — Webhooks (Maker Event)",
  "desc": "Zdarzenie Webhooks (Maker) w IFTTT — uruchamia dowolny aplet, np. włączenie światła.",
  "verified": true,
  "baseUrlHint": "https://maker.ifttt.com",
  "credential": "Osobisty klucz Webhooks (długi ciąg znaków) — zaloguj się na ifttt.com, wejdź na https://ifttt.com/maker_webhooks i kliknij przycisk „Documentation”; klucz widnieje w zdaniu „Your key is:”. Zapisz go w sejfie RibbitFlip jako poświadczenie typu query/tekst o identyfikatorze IFTTT_KEY i wstawiaj wyłącznie przez {{secret.IFTTT_KEY}} w ścieżce (IFTTT wymaga klucza w URL, nie w nagłówku).",
  "actions": [
    {
      "name": "Wyzwól zdarzenie IFTTT (3 wartości)",
      "desc": "Uruchamia aplet „Receive a web request” i przekazuje trzy wartości: nazwę wyzwalacza, pochylenie i czas zdarzenia.",
      "method": "POST",
      "path": "/trigger/{{var.IFTTT_EVENT}}/with/key/{{secret.IFTTT_KEY}}",
      "query": [],
      "headers": [
        [
          "Content-Type",
          "application/json"
        ]
      ],
      "bodyType": "json",
      "body": "{\"value1\":\"{{trigger.label}}\",\"value2\":\"{{pose.tilt}}\",\"value3\":\"{{ts.iso}}\"}"
    },
    {
      "name": "Wyślij pełny pomiar ruchu (JSON)",
      "desc": "Uruchamia aplet „Receive a web request with a JSON payload” i przesyła komplet danych kapsla do rozbioru w filter code.",
      "method": "POST",
      "path": "/trigger/{{var.IFTTT_EVENT}}/json/with/key/{{secret.IFTTT_KEY}}",
      "query": [],
      "headers": [
        [
          "Content-Type",
          "application/json"
        ]
      ],
      "bodyType": "json",
      "body": "{\"trigger\":\"{{trigger.label}}\",\"device\":\"{{device.name}}\",\"tilt\":{{pose.tilt}},\"pitch\":{{pose.pitch}},\"roll\":{{pose.roll}},\"twist\":{{pose.twist}},\"ch\":[{{ch0}},{{ch1}},{{ch2}},{{ch3}},{{ch4}},{{ch5}}],\"ts\":\"{{ts.iso}}\",\"unix\":{{ts.unix}},\"counter\":{{counter}}}"
    },
    {
      "name": "Alarm przechylenia kapsla",
      "desc": "Powiadamia osobny aplet alarmowy, gdy kapsel przekroczy ustawiony próg pochylenia — wysyła kąt i licznik zdarzeń.",
      "method": "POST",
      "path": "/trigger/{{var.IFTTT_EVENT_ALARM}}/with/key/{{secret.IFTTT_KEY}}",
      "query": [],
      "headers": [
        [
          "Content-Type",
          "application/json"
        ]
      ],
      "bodyType": "json",
      "body": "{\"value1\":\"Przechylenie {{pose.tilt}} st.\",\"value2\":\"{{device.name}}\",\"value3\":\"zdarzenie nr {{counter}} o {{ts.iso}}\"}"
    },
    {
      "name": "Szybki ping zdarzenia (bez treści)",
      "desc": "Minimalne wyzwolenie apletu bez danych — do prostych akcji typu włącz światło albo odtwórz scenę.",
      "method": "POST",
      "path": "/trigger/{{var.IFTTT_EVENT}}/with/key/{{secret.IFTTT_KEY}}",
      "query": [],
      "headers": [],
      "bodyType": "none",
      "body": ""
    }
  ],
  "guidePL": "1. Załóż (lub zaloguj się na) darmowe konto na https://ifttt.com.\n2. Wejdź na https://ifttt.com/maker_webhooks i kliknij „Connect”, jeśli usługa Webhooks nie jest jeszcze podłączona.\n3. Na tej samej stronie kliknij przycisk „Documentation” (prawy górny róg). Otworzy się strona maker.ifttt.com/use/… — skopiuj klucz ze zdania „Your key is: …”.\n4. W RibbitFlip otwórz sejf poświadczeń, dodaj nowy wpis o identyfikatorze IFTTT_KEY, wklej skopiowany klucz i zapisz. Klucz nigdy nie jest wpisywany wprost w akcji — używamy odwołania {{secret.IFTTT_KEY}}.\n5. W ustawieniach API ustaw adres bazowy: https://maker.ifttt.com\n6. Wróć na IFTTT i utwórz aplet: „Create” → „If This” → wyszukaj „Webhooks” → wybierz „Receive a web request” (dla akcji z value1..3) albo „Receive a web request with a JSON payload” (dla akcji z pełnym pomiarem). W polu „Event Name” wpisz własną nazwę bez spacji, np. ribbitflip.\n7. Wybierz „Then That” i wskaż, co ma się stać (np. powiadomienie w telefonie, wpis w Arkuszach Google, włączenie światła). Zapisz aplet i upewnij się, że jest włączony.\n8. W RibbitFlip dodaj zmienną {{var.IFTTT_EVENT}} o wartości dokładnie takiej samej jak „Event Name” z kroku 6 (np. ribbitflip). Jeśli używasz akcji alarmowej, dodaj drugą zmienną {{var.IFTTT_EVENT_ALARM}} z nazwą drugiego apletu.\n9. Podepnij wybraną akcję pod wyzwalacz kapsla i wykonaj ruch testowy. Poprawne wywołanie zwraca kod 200 i tekst „Congratulations! You've fired the … event”.\n10. Jeśli dostaniesz błąd 401 „You sent an invalid key”, klucz jest zły lub niekompletny — powtórz kroki 3–4. Jeśli aplet nie reaguje mimo kodu 200, sprawdź pisownię nazwy zdarzenia oraz czy dla wariantu JSON adres zawiera człon /json/.",
  "caveats": "Klucz Webhooks jest równoznaczny z dostępem do Twoich apletów — każdy, kto go pozna, może je uruchamiać; trzymaj go wyłącznie w sejfie i nie udostępniaj zrzutów ekranu z adresem maker.ifttt.com/use/…. Darmowy plan IFTTT pozwala na bardzo małą liczbę aktywnych apletów (obecnie 2; Pro ok. 20, Pro+ bez limitu) i nie obejmuje filter code — rozbiór ładunku JSON w JavaScripcie wymaga planu Pro+, więc na koncie darmowym praktyczniejszy jest wariant z value1..value3. IFTTT nie publikuje twardych limitów żądań dla Webhooks, ale zastrzega możliwość ograniczania przepustowości — nie wysyłaj setek zdarzeń na minutę z kapsla; rozważ dławienie w wyzwalaczu. Wykonanie apletu bywa opóźnione o kilka–kilkadziesiąt sekund, więc nie nadaje się do sterowania w czasie rzeczywistym. Klucz można unieważnić w ustawieniach usługi Webhooks — po regeneracji trzeba go zaktualizować w sejfie. Zmienne {{var.IFTTT_EVENT}} i {{var.IFTTT_EVENT_ALARM}} musisz utworzyć samodzielnie, inaczej adres będzie niepoprawny.",
  "en": {
    "name": "IFTTT — Webhooks (Maker Event)",
    "desc": "A Webhooks (Maker) event in IFTTT — fires any applet, e.g. turning a light on.",
    "credential": "Your personal Webhooks key (a long string of characters) — sign in at ifttt.com, go to https://ifttt.com/maker_webhooks and click the \"Documentation\" button; the key appears in the sentence \"Your key is:\". Store it in the RibbitFlip vault as a query/text credential with the id IFTTT_KEY and insert it only through {{secret.IFTTT_KEY}} in the path (IFTTT requires the key in the URL, not in a header).",
    "guide": "1. Create (or sign in to) a free account at https://ifttt.com.\n2. Go to https://ifttt.com/maker_webhooks and click \"Connect\" if the Webhooks service is not connected yet.\n3. On the same page click the \"Documentation\" button (top right). The page maker.ifttt.com/use/… opens — copy the key from the sentence \"Your key is: …\".\n4. In RibbitFlip open the credential vault, add a new entry with the id IFTTT_KEY, paste the copied key and save. The key is never typed directly into an action — you reference it with {{secret.IFTTT_KEY}}.\n5. In the app settings set the base address to: https://maker.ifttt.com\n6. Go back to IFTTT and create an applet: \"Create\" → \"If This\" → search for \"Webhooks\" → choose \"Receive a web request\" (for actions using value1..3) or \"Receive a web request with a JSON payload\" (for the action with the full motion data). In \"Event Name\" enter your own name without spaces, e.g. ribbitflip.\n7. Choose \"Then That\" and pick what should happen (a phone notification, a row in Google Sheets, turning on a light, etc.). Save the applet and make sure it is enabled.\n8. In RibbitFlip add the variable {{var.IFTTT_EVENT}} with exactly the same value as the \"Event Name\" from step 6 (e.g. ribbitflip). If you use the alarm action, add a second variable {{var.IFTTT_EVENT_ALARM}} with the name of the second applet.\n9. Attach the chosen action to a capsule trigger and make a test move. A successful call returns status 200 and the text \"Congratulations! You've fired the … event\".\n10. If you get a 401 error \"You sent an invalid key\", the key is wrong or incomplete — repeat steps 3–4. If the applet does not react despite a 200 response, check the spelling of the event name and, for the JSON variant, that the address contains the /json/ segment.",
    "caveats": "The Webhooks key is equivalent to access to your applets — anyone who learns it can fire them; keep it in the vault only and never share screenshots showing the maker.ifttt.com/use/… address. The free IFTTT plan allows a very small number of active applets (currently 2; Pro about 20, Pro+ unlimited) and does not include filter code — parsing a JSON payload in JavaScript requires Pro+, so on a free account the value1..value3 variant is more practical. IFTTT does not publish hard request limits for Webhooks, but reserves the right to throttle — do not send hundreds of events per minute from the capsule; consider rate-limiting in the trigger. Applet execution can be delayed by seconds to tens of seconds, so it is not suitable for real-time control. The key can be revoked in the Webhooks service settings — after regenerating it you must update it in the vault. You have to create the variables {{var.IFTTT_EVENT}} and {{var.IFTTT_EVENT_ALARM}} yourself, otherwise the address will be invalid.",
    "actions": [
      {
        "name": "Fire IFTTT event (3 values)",
        "desc": "Runs a \"Receive a web request\" applet and passes three values: the trigger name, the tilt angle and the event time."
      },
      {
        "name": "Send full motion data (JSON)",
        "desc": "Runs a \"Receive a web request with a JSON payload\" applet and sends the complete capsule data for parsing in filter code."
      },
      {
        "name": "Capsule tilt alarm",
        "desc": "Notifies a separate alarm applet when the capsule exceeds the tilt threshold you set — sends the angle and the event counter."
      },
      {
        "name": "Quick event ping (no body)",
        "desc": "A minimal applet trigger with no data — for simple actions such as turning on a light or playing a scene."
      }
    ]
  }
},
{
  "key": "homeassistant",
  "name": "Home Assistant",
  "desc": "Sterowanie domem: webhooki i usługi Home Assistanta.",
  "verified": true,
  "baseUrlHint": "http://homeassistant.local:8123",
  "credential": "Długoterminowy token dostępu (Long-Lived Access Token) z Home Assistant: kliknij swój awatar w lewym dolnym rogu → zakładka „Bezpieczeństwo” (Security) → sekcja „Długoterminowe tokeny dostępu” → „Utwórz token”. Zapisz go w sejfie RibbitFlip jako typ „bearer” (trafi do nagłówka Authorization: Bearer …); akcja webhooka działa bez tokenu.",
  "actions": [
    {
      "name": "Wyzwól automatyzację (webhook)",
      "desc": "Wysyła zdarzenie z kapsla do automatyzacji Home Assistant z wyzwalaczem typu webhook — bez tokenu, dane dostępne w automatyzacji jako trigger.json.",
      "method": "POST",
      "path": "/api/webhook/{{var.WEBHOOK_ID}}",
      "query": [],
      "headers": [
        [
          "Content-Type",
          "application/json"
        ]
      ],
      "bodyType": "json",
      "body": "{\"zrodlo\": \"RibbitFlip\", \"urzadzenie\": \"{{device.name}}\", \"wyzwalacz\": \"{{trigger.label}}\", \"tilt\": {{pose.tilt}}, \"twist\": {{pose.twist}}, \"licznik\": {{counter}}, \"czas\": \"{{ts.iso}}\"}"
    },
    {
      "name": "Przełącz światło",
      "desc": "Włącza lub wyłącza wskazaną encję światła (light.toggle) — jedno puknięcie kapslem zmienia stan lampy.",
      "method": "POST",
      "path": "/api/services/light/toggle",
      "query": [],
      "headers": [
        [
          "Content-Type",
          "application/json"
        ]
      ],
      "bodyType": "json",
      "body": "{\"entity_id\": \"{{var.ENTITY_ID}}\"}"
    },
    {
      "name": "Jasność światła z pochylenia",
      "desc": "Ustawia jasność światła w procentach równą kątowi pochylenia kapsla (0–90), więc przechylanie działa jak ściemniacz.",
      "method": "POST",
      "path": "/api/services/light/turn_on",
      "query": [],
      "headers": [
        [
          "Content-Type",
          "application/json"
        ]
      ],
      "bodyType": "json",
      "body": "{\"entity_id\": \"{{var.ENTITY_ID}}\", \"brightness_pct\": {{pose.tilt}}}"
    },
    {
      "name": "Uruchom scenę",
      "desc": "Aktywuje wskazaną scenę Home Assistant (scene.turn_on), np. „wieczór” albo „kino”.",
      "method": "POST",
      "path": "/api/services/scene/turn_on",
      "query": [],
      "headers": [
        [
          "Content-Type",
          "application/json"
        ]
      ],
      "bodyType": "json",
      "body": "{\"entity_id\": \"{{var.SCENE_ID}}\"}"
    }
  ],
  "guidePL": "1. Sprawdź adres swojego Home Assistanta. Zwykle jest to http://homeassistant.local:8123 — wpisz go w przeglądarce; jeśli nie działa, użyj adresu IP, np. http://192.168.1.50:8123. Ten adres wklej w RibbitFlip w pole „baseUrl” (adres bazowy API).\n2. Zdobądź token. W Home Assistant kliknij swój awatar (lewy dolny róg) → zakładka „Bezpieczeństwo” → przewiń na sam dół do „Długoterminowe tokeny dostępu” → „Utwórz token” → nazwij go np. „RibbitFlip” → skopiuj długi ciąg znaków. Pokazuje się TYLKO RAZ.\n3. Wklej token do sejfu RibbitFlip: dodaj nowe poświadczenie typu „bearer”, wklej skopiowany ciąg i przypisz je do tego API. RibbitFlip sam doda nagłówek „Authorization: Bearer …” — nigdy nie wpisuj tokenu ręcznie w treści akcji.\n4. Znajdź identyfikator urządzenia (entity_id). W Home Assistant: Ustawienia → Urządzenia i usługi → zakładka „Encje”, wyszukaj swoją lampę i skopiuj identyfikator, np. light.salon_lampa. W RibbitFlip dodaj zmienną ENTITY_ID i wklej tam tę wartość (akcje używają {{var.ENTITY_ID}}).\n5. Dla akcji „Uruchom scenę” tak samo wyszukaj encję zaczynającą się od scene. (np. scene.wieczor) i zapisz ją w zmiennej SCENE_ID.\n6. Jeśli chcesz użyć akcji webhook: w Home Assistant wejdź w Ustawienia → Automatyzacje i sceny → „Utwórz automatyzację” → „Dodaj wyzwalacz” → „Webhook”. Home Assistant wygeneruje identyfikator webhooka — skopiuj go (albo wpisz własny, długi i losowy, np. rf-kapsel-9f3k2x).\n7. W tej samej automatyzacji dodaj akcję, którą ma wykonać kapsel (np. włączenie sceny), i zapisz automatyzację.\n8. Skopiowany identyfikator webhooka wklej w RibbitFlip do zmiennej WEBHOOK_ID (akcja używa {{var.WEBHOOK_ID}}).\n9. Przetestuj: w RibbitFlip kliknij „Wyślij testowo” przy akcji. Poprawna odpowiedź to kod 200 (dla webhooka odpowiedź bywa pusta — sprawdź, czy automatyzacja się uruchomiła w jej historii).\n10. Na koniec podepnij akcję pod wyzwalacz kapsla (puknięcie, przechył) i sprawdź na żywo.",
  "caveats": "Token długoterminowy ma ważność 10 lat, ale ma PEŁNE uprawnienia Twojego konta — jeśli wycieknie, natychmiast usuń go w profilu → Bezpieczeństwo; bezpieczniej założyć osobne, nie-administracyjne konto dla RibbitFlip. Webhook domyślnie działa tylko z sieci lokalnej (local_only: true) i przyjmuje POST oraz PUT — z internetu zadziała przez Nabu Casa Cloud lub po odznaczeniu tej opcji; identyfikator webhooka traktuj jak hasło (dowolna osoba w sieci lokalnej znająca go uruchomi automatyzację), więc nie podpinaj pod niego zamków ani bramy garażowej. Akcja „Jasność z pochylenia” daje maksymalnie 90% jasności, bo kąt pochylenia kończy się na 90°. Adres homeassistant.local wymaga działającego mDNS — na części sieci trzeba wpisać IP; połączenie po http (bez szyfrowania) nadaje się wyłącznie do sieci domowej.",
  "en": {
    "name": "Home Assistant",
    "desc": "Home control: Home Assistant webhooks and services.",
    "credential": "A Long-Lived Access Token from Home Assistant: click your avatar in the bottom left corner → \"Security\" tab → \"Long-lived access tokens\" section → \"Create token\". Store it in the RibbitFlip vault as a \"bearer\" credential (it goes into the Authorization: Bearer … header); the webhook action works without a token.",
    "guide": "1. Find your Home Assistant address. It is usually http://homeassistant.local:8123 — type it into your browser; if that does not work, use the IP address, e.g. http://192.168.1.50:8123. Paste that address into the RibbitFlip \"baseUrl\" field (the app's base address).\n2. Get a token. In Home Assistant click your avatar (bottom left corner) → \"Security\" tab → scroll all the way down to \"Long-lived access tokens\" → \"Create token\" → name it e.g. \"RibbitFlip\" → copy the long string. It is shown ONLY ONCE.\n3. Paste the token into the RibbitFlip vault: add a new \"bearer\" credential, paste the copied string and assign it to this app. RibbitFlip adds the \"Authorization: Bearer …\" header for you — never type the token by hand into an action body.\n4. Find the entity id. In Home Assistant: Settings → Devices & services → \"Entities\" tab, search for your lamp and copy its id, e.g. light.living_room_lamp. In RibbitFlip add a variable ENTITY_ID and paste that value there (the actions use {{var.ENTITY_ID}}).\n5. For the \"Activate scene\" action, find an entity starting with scene. in the same way (e.g. scene.evening) and save it in the variable SCENE_ID.\n6. If you want to use the webhook action: in Home Assistant go to Settings → Automations & scenes → \"Create automation\" → \"Add trigger\" → \"Webhook\". Home Assistant generates a webhook id — copy it (or enter your own, long and random one, e.g. rf-capsule-9f3k2x).\n7. In the same automation add the action the capsule should perform (turning on a scene, for example) and save the automation.\n8. Paste the copied webhook id into the RibbitFlip variable WEBHOOK_ID (the action uses {{var.WEBHOOK_ID}}).\n9. Test it: in RibbitFlip click \"Send test\" next to the action. A correct response is status 200 (for the webhook the response is often empty — check the automation's trace to see whether it ran).\n10. Finally, attach the action to a capsule trigger (a tap, a tilt) and check it live.",
    "caveats": "A long-lived token is valid for 10 years, but it carries the FULL permissions of your account — if it leaks, delete it immediately in your profile → Security; it is safer to create a separate, non-administrator account for RibbitFlip. By default the webhook only works from the local network (local_only: true) and accepts POST and PUT — from the internet it works only via Nabu Casa Cloud or after unchecking that option; treat the webhook id like a password (anyone on your local network who knows it can run the automation), so do not wire it to door locks or the garage door. The \"Brightness from tilt\" action gives at most 90% brightness, because the tilt angle stops at 90°. The homeassistant.local address requires working mDNS — on some networks you have to use the IP; an http connection (unencrypted) is suitable for a home network only.",
    "actions": [
      {
        "name": "Trigger automation (webhook)",
        "desc": "Sends a capsule event to a Home Assistant automation with a webhook trigger — no token needed, the data is available in the automation as trigger.json."
      },
      {
        "name": "Toggle light",
        "desc": "Turns the selected light entity on or off (light.toggle) — one tap of the capsule changes the lamp's state."
      },
      {
        "name": "Brightness from tilt",
        "desc": "Sets the light brightness in percent equal to the capsule's tilt angle (0–90), so tilting works like a dimmer."
      },
      {
        "name": "Activate scene",
        "desc": "Activates the selected Home Assistant scene (scene.turn_on), e.g. \"evening\" or \"movie night\"."
      }
    ]
  }
},
{
  "key": "spotify",
  "name": "Spotify — sterowanie odtwarzaczem",
  "desc": "Sterowanie odtwarzaniem w Spotify (wymaga Premium i aktywnego urządzenia).",
  "verified": true,
  "baseUrlHint": "https://api.spotify.com/v1",
  "credential": "Poświadczenie typu bearer (token dostępu OAuth użytkownika, wysyłany jako nagłówek Authorization: Bearer …). Zdobywasz je w portalu developer.spotify.com dla własnej aplikacji, logując się swoim kontem Spotify Premium i zgadzając na uprawnienie (scope) user-modify-playback-state.",
  "actions": [
    {
      "name": "Pauza odtwarzania",
      "desc": "Zatrzymuje aktualnie grający utwór na aktywnym urządzeniu Spotify Connect.",
      "method": "PUT",
      "path": "/me/player/pause",
      "query": [],
      "headers": [],
      "bodyType": "none",
      "body": ""
    },
    {
      "name": "Wznów odtwarzanie",
      "desc": "Wznawia odtwarzanie od miejsca, w którym zostało zatrzymane (bez zmiany playlisty).",
      "method": "PUT",
      "path": "/me/player/play",
      "query": [],
      "headers": [
        [
          "Content-Type",
          "application/json"
        ]
      ],
      "bodyType": "json",
      "body": "{}"
    },
    {
      "name": "Następny utwór",
      "desc": "Przeskakuje do kolejnego utworu w kolejce — dobre pod puknięcie lub szybki obrót kapsla.",
      "method": "POST",
      "path": "/me/player/next",
      "query": [],
      "headers": [],
      "bodyType": "none",
      "body": ""
    },
    {
      "name": "Poprzedni utwór",
      "desc": "Cofa do poprzedniego utworu w kolejce odtwarzania.",
      "method": "POST",
      "path": "/me/player/previous",
      "query": [],
      "headers": [],
      "bodyType": "none",
      "body": ""
    }
  ],
  "guidePL": "1. Wejdź na https://developer.spotify.com i zaloguj się swoim zwykłym kontem Spotify (musi to być konto z abonamentem Premium — bez Premium te akcje nie zadziałają).\n2. Kliknij swoją nazwę w prawym górnym rogu → „Dashboard” → przycisk „Create app”. Wpisz dowolną nazwę (np. „RibbitFlip”) i opis, a w polu „Redirect URI” wpisz dokładnie: http://127.0.0.1:8888/callback (uwaga: słowo „localhost” Spotify odrzuca od 2025 roku — musi być liczbowe 127.0.0.1). Zaznacz „Web API” i zapisz.\n3. W ustawieniach aplikacji („Settings”) skopiuj „Client ID”, a po kliknięciu „View client secret” także „Client secret”. Zachowaj je na boku — będą potrzebne tylko do zdobycia tokenu.\n4. Zdobądź token osobisty. Najprościej: na stronie dokumentacji Spotify otwórz dowolny endpoint gracza (np. „Pause Playback”), w sekcji „Try it” kliknij logowanie i zgódź się na uprawnienie „user-modify-playback-state” — konsola pokaże gotowy token. Alternatywa dla wygody: użyj gotowego generatora tokenu w swoim pośredniku n8n (patrz punkt 8).\n5. W RibbitFlip otwórz sejf poświadczeń i dodaj nowe poświadczenie typu „bearer”. W pole wartości wklej sam token (bez słowa „Bearer” z przodu). Nazwij je np. SPOTIFY.\n6. W konfiguracji API ustaw baseUrl na: https://api.spotify.com/v1 i przypisz do niego poświadczenie SPOTIFY. RibbitFlip sam doda nagłówek Authorization: Bearer …\n7. Zanim sprawdzisz wyzwalacz, włącz muzykę w aplikacji Spotify na telefonie lub komputerze — komendy działają na „aktywnym urządzeniu”, więc coś musi już grać albo być wybrane w Spotify Connect. Potem puknij kapslem i sprawdź, czy utwór się zatrzymuje/przeskakuje.\n8. Ważne na dłużej: token wygasa po około godzinie i akcje przestaną działać (błąd 401). Trwałe rozwiązanie to pośrednik — postaw w n8n prosty webhook z poświadczeniem „Spotify OAuth2”, które samo odświeża token, a w RibbitFlip ustaw baseUrl na adres tego webhooka zamiast na api.spotify.com. Wtedy poświadczenie w sejfie RibbitFlip to już tylko Twój własny klucz do n8n.\n9. Jeśli chcesz sterować głośnością pochyleniem kapsla, dodaj własną akcję: metoda PUT, ścieżka /me/player/volume, parametr zapytania volume_percent o wartości {{pose.tilt}} (pochylenie 0–90 przełoży się na głośność 0–90%). Sprawdź, czy Twoje wyzwalacze podają liczbę całkowitą — Spotify przyjmuje tylko liczby całkowite 0–100.",
  "caveats": "Wymagane konto Spotify Premium — na koncie darmowym wszystkie te endpointy zwracają błąd 403. Token dostępu OAuth wygasa po ~1 godzinie (expires_in=3600), więc token wklejony ręcznie do sejfu przestanie działać tego samego dnia; trwale działa dopiero pośrednik (np. n8n z poświadczeniem Spotify OAuth2, które odświeża token w tle) — dlatego traktuj konfigurację „na sztywno” jako tymczasową. Komendy działają wyłącznie na aktywnym urządzeniu Spotify Connect: jeśli nic nie gra i żadne urządzenie nie jest wybrane, dostaniesz 404 „NO_ACTIVE_DEVICE”. Sukces to odpowiedź 204 bez treści (brak widocznej treści odpowiedzi to normalne). Spotify nie gwarantuje kolejności wykonania, gdy kilka komend gracza poleci szybko po sobie — przy serii puknięć efekt może się rozjechać; obowiązuje też limit zapytań (429). Od 2025 r. adres przekierowania nie może zawierać słowa „localhost” — tylko https:// lub pętla zwrotna 127.0.0.1 / [::1]. Token daje dostęp do sterowania Twoim odtwarzaniem — trzymaj go wyłącznie w sejfie, nigdy w treści akcji.",
  "en": {
    "name": "Spotify — player control",
    "desc": "Playback control in Spotify (needs Premium and an active device).",
    "credential": "A bearer credential (the user's OAuth access token, sent as the header Authorization: Bearer …). You get it at developer.spotify.com for an app you create yourself, by signing in with your Spotify Premium account and granting the user-modify-playback-state scope.",
    "guide": "1. Go to https://developer.spotify.com and sign in with your normal Spotify account (it must be a Premium account — without Premium these actions will not work).\n2. Click your name in the top right corner → \"Dashboard\" → the \"Create app\" button. Enter any name (for example \"RibbitFlip\") and a description, and in the \"Redirect URI\" field enter exactly: http://127.0.0.1:8888/callback (note: Spotify has rejected the word \"localhost\" since 2025 — it must be the numeric 127.0.0.1). Tick \"Web API\" and save.\n3. In the app's \"Settings\", copy the \"Client ID\", then click \"View client secret\" and copy the \"Client secret\" too. Keep them aside — you only need them to obtain the token.\n4. Get a personal token. The easiest way: open any player endpoint in the Spotify documentation (for example \"Pause Playback\"), click the sign-in button in the \"Try it\" section and grant the \"user-modify-playback-state\" scope — the console will show you a ready-made token. A more convenient alternative: use a token generator in your own n8n relay (see step 8).\n5. In RibbitFlip, open the credential vault and add a new credential of type \"bearer\". Paste the token itself into the value field (without the word \"Bearer\" in front). Name it something like SPOTIFY.\n6. In the API configuration, set baseUrl to: https://api.spotify.com/v1 and assign the SPOTIFY credential to it. RibbitFlip adds the Authorization: Bearer … header for you.\n7. Before you test a trigger, start playing music in the Spotify app on your phone or computer — the commands act on the \"active device\", so something must already be playing or be selected in Spotify Connect. Then tap the capsule and check whether the track pauses or skips.\n8. Important for the long run: the token expires after about an hour and the actions will stop working (error 401). The permanent fix is a relay — set up a simple webhook in n8n with a \"Spotify OAuth2\" credential, which refreshes the token by itself, and in RibbitFlip point baseUrl at that webhook instead of api.spotify.com. The credential in the RibbitFlip vault is then just your own key to n8n.\n9. If you want to control the volume by tilting the capsule, add your own action: method PUT, path /me/player/volume, query parameter volume_percent with the value {{pose.tilt}} (a tilt of 0–90 maps to a volume of 0–90%). Check that your triggers send a whole number — Spotify only accepts integers from 0 to 100.",
    "caveats": "A Spotify Premium account is required — on a free account all of these endpoints return error 403. The OAuth access token expires after about 1 hour (expires_in=3600), so a token pasted into the vault by hand will stop working the same day; only a relay works permanently (for example n8n with a Spotify OAuth2 credential that refreshes the token in the background) — so treat the hard-coded setup as temporary. The commands only act on the active Spotify Connect device: if nothing is playing and no device is selected, you will get a 404 \"NO_ACTIVE_DEVICE\". Success is a 204 response with no body (seeing no response content is normal). Spotify does not guarantee the execution order when several player commands are fired in quick succession — a burst of taps can end up out of sync; rate limits also apply (429). Since 2025 the redirect URI may not contain the word \"localhost\" — only https:// or the loopback address 127.0.0.1 / [::1]. The token gives control over your playback — keep it in the vault only, never inside the body of an action.",
    "actions": [
      {
        "name": "Pause playback",
        "desc": "Stops the track currently playing on the active Spotify Connect device."
      },
      {
        "name": "Resume playback",
        "desc": "Resumes playback from where it was stopped (without changing the playlist)."
      },
      {
        "name": "Next track",
        "desc": "Skips to the next track in the queue — a good fit for a tap or a quick spin of the capsule."
      },
      {
        "name": "Previous track",
        "desc": "Goes back to the previous track in the playback queue."
      }
    ]
  }
},
{
  "key": "hue",
  "name": "Philips Hue — mostek lokalny",
  "desc": "Sterowanie żarówkami Philips Hue przez mostek w sieci domowej.",
  "verified": true,
  "baseUrlHint": "https://ADRES-IP-MOSTKA",
  "credential": "Poświadczeniem jest „username” (klucz aplikacji) generowany przez sam mostek: wysyłasz POST /api z dowolną nazwą urządzenia w ciągu 30 sekund po naciśnięciu okrągłego przycisku link na mostku, a mostek zwraca ciąg ~40 znaków. Wklej go do sejfu RibbitFlip jako sekret o ID HUE_KEY — w API v1 wchodzi on w ŚCIEŻKĘ adresu ({{secret.HUE_KEY}}), nie w nagłówek.",
  "actions": [
    {
      "name": "Sparuj mostek (utwórz klucz)",
      "desc": "Jednorazowo tworzy klucz aplikacji — naciśnij przycisk link na mostku i w ciągu 30 sekund wywołaj tę akcję, a w odpowiedzi dostaniesz swój username.",
      "method": "POST",
      "path": "/api",
      "query": [],
      "headers": [
        [
          "Content-Type",
          "application/json"
        ]
      ],
      "bodyType": "json",
      "body": "{\"devicetype\":\"ribbitflip#{{device.name}}\"}"
    },
    {
      "name": "Włącz światło na pełną jasność",
      "desc": "Zapala wskazane światło i ustawia maksymalną jasność (bri 254).",
      "method": "PUT",
      "path": "/api/{{secret.HUE_KEY}}/lights/{{var.HUE_LIGHT}}/state",
      "query": [],
      "headers": [
        [
          "Content-Type",
          "application/json"
        ]
      ],
      "bodyType": "json",
      "body": "{\"on\":true,\"bri\":254}"
    },
    {
      "name": "Wyłącz światło",
      "desc": "Gasi wskazane światło (np. na puknięcie w kapsel).",
      "method": "PUT",
      "path": "/api/{{secret.HUE_KEY}}/lights/{{var.HUE_LIGHT}}/state",
      "query": [],
      "headers": [
        [
          "Content-Type",
          "application/json"
        ]
      ],
      "bodyType": "json",
      "body": "{\"on\":false}"
    },
    {
      "name": "Jasność i kolor z ruchu kapsla",
      "desc": "Steruje jasnością i barwą światła wartościami z kanałów ruchu — kanał 0 przeskalowany na 1-254 (bri), kanał 1 na 0-65535 (hue).",
      "method": "PUT",
      "path": "/api/{{secret.HUE_KEY}}/lights/{{var.HUE_LIGHT}}/state",
      "query": [],
      "headers": [
        [
          "Content-Type",
          "application/json"
        ]
      ],
      "bodyType": "json",
      "body": "{\"on\":true,\"bri\":{{ch0}},\"hue\":{{ch1}},\"sat\":254,\"transitiontime\":1}"
    }
  ],
  "guidePL": "1. Ustal adres IP mostka Hue: wejdź w przeglądarce na https://discovery.meethue.com (będąc w tej samej sieci Wi-Fi co mostek) — zobaczysz coś w stylu [{\"id\":\"...\",\"internalipaddress\":\"192.168.1.42\"}]. Ten adres z pola internalipaddress to Twój mostek. Alternatywnie znajdziesz go w aplikacji Philips Hue: Ustawienia → Mostek → informacje o sieci.\n2. W RibbitFlip dodaj nowe API i w polu baseUrl wpisz https://192.168.1.42 (podstaw swój adres IP, koniecznie https, bez ukośnika na końcu).\n3. Podejdź do mostka i naciśnij duży okrągły przycisk na jego obudowie, a potem w ciągu 30 sekund uruchom w RibbitFlip akcję „Sparuj mostek (utwórz klucz)”.\n4. W odpowiedzi zobaczysz coś takiego: [{\"success\":{\"username\":\"1028d66426293e821ecfd9ef1a0731df\"}}]. Skopiuj sam ciąg znaków ze środka cudzysłowu (bez cudzysłowów).\n5. Otwórz sejf poświadczeń w RibbitFlip, dodaj nowy sekret o identyfikatorze HUE_KEY (typ: zwykła wartość / w ścieżce) i wklej tam skopiowany ciąg. Od tej pory w adresach akcji podstawia się on jako {{secret.HUE_KEY}} — nigdy nie wpisuj go na sztywno.\n6. Sprawdź numery świateł: w przeglądarce otwórz https://ADRES-IP/api/TWÓJ-KLUCZ/lights — zobaczysz listę typu \"1\": {\"name\":\"Salon lampa\"...}. Zapamiętaj cyfrę przy lampie, którą chcesz sterować.\n7. W RibbitFlip dodaj zmienną HUE_LIGHT i wpisz w niej tę cyfrę (np. 1). Dzięki temu jedna akcja obsłuży dowolną lampę bez grzebania w adresie.\n8. Podłącz akcję „Włącz światło na pełną jasność” pod wyzwalacz pochylenia, a „Wyłącz światło” pod puknięcie — i sprawdź na żywo.\n9. Dla akcji „Jasność i kolor z ruchu kapsla” ustaw w mapowaniu kanałów RibbitFlip: kanał 0 → zakres 1–254 (jasność, wartości całkowite), kanał 1 → zakres 0–65535 (barwa). Bez tego przeskalowania mostek odrzuci wartości spoza zakresu.\n10. Jeżeli przy pierwszym połączeniu RibbitFlip zgłosi problem z certyfikatem, włącz w ustawieniach API opcję ignorowania certyfikatu (mostek w sieci domowej przedstawia certyfikat, którego przeglądarki i biblioteki HTTP często nie znają).",
  "caveats": "API v1 (username w ścieżce) jest prostsze niż CLIP v2 i nadal działa, ale Signify oznaczyło je jako przestarzałe — docelowo trzeba będzie przejść na /clip/v2/resource/light z nagłówkiem hue-application-key (ten sam klucz, ale identyfikatory świateł to UUID-y, a jasność podaje się w procentach 0-100). Zwykłe http:// jest wygaszane (od sierpnia, w związku z wymogami RED) — używaj wyłącznie https://, a mostek może przedstawiać certyfikat wymagający zaufania/wyjątku. Wszystko działa tylko w lokalnej sieci — poza domem trzeba chmury Hue z OAuth2 (osobna rejestracja aplikacji). Adres IP mostka może się zmienić po restarcie routera, jeśli nie nadasz mu rezerwacji DHCP. Zbyt częste requesty (powyżej ~10/s na światło) mostek odrzuca — przy sterowaniu ruchem ustaw ograniczenie tempa wyzwalacza.",
  "en": {
    "name": "Philips Hue — local bridge",
    "desc": "Control Philips Hue bulbs through the bridge on your home network.",
    "credential": "The credential is the \"username\" (application key) generated by the bridge itself: you send POST /api with any device name within 30 seconds of pressing the round link button on the bridge, and the bridge returns a string of about 40 characters. Paste it into the RibbitFlip vault as a secret with the ID HUE_KEY — in API v1 it goes into the URL PATH ({{secret.HUE_KEY}}), not into a header.",
    "guide": "1. Find the IP address of the Hue bridge: open https://discovery.meethue.com in a browser (while on the same Wi-Fi network as the bridge) — you will see something like [{\"id\":\"...\",\"internalipaddress\":\"192.168.1.42\"}]. The address in the internalipaddress field is your bridge. You can also find it in the Philips Hue app: Settings → Bridge → network information.\n2. In RibbitFlip add a new API and enter https://192.168.1.42 in the baseUrl field (substitute your own IP address, https is required, no trailing slash).\n3. Walk over to the bridge and press the big round button on its case, then within 30 seconds run the \"Pair the bridge (create a key)\" action in RibbitFlip.\n4. The response will look like this: [{\"success\":{\"username\":\"1028d66426293e821ecfd9ef1a0731df\"}}]. Copy just the string between the quotes (without the quotes).\n5. Open the credential vault in RibbitFlip, add a new secret with the identifier HUE_KEY (type: plain value / in path) and paste the copied string there. From now on it is substituted into action URLs as {{secret.HUE_KEY}} — never hard-code it.\n6. Look up your light numbers: in a browser open https://BRIDGE-IP/api/YOUR-KEY/lights — you will see a list like \"1\": {\"name\":\"Living room lamp\"...}. Note the number next to the lamp you want to control.\n7. In RibbitFlip add a variable named HUE_LIGHT and enter that number (for example 1). This way one action can drive any lamp without editing the URL.\n8. Assign the \"Turn the light on at full brightness\" action to a tilt trigger and \"Turn the light off\" to a tap — then try it live.\n9. For the \"Brightness and colour from capsule motion\" action, set the channel mapping in RibbitFlip: channel 0 → range 1–254 (brightness, integers), channel 1 → range 0–65535 (hue). Without that scaling the bridge will reject out-of-range values.\n10. If RibbitFlip reports a certificate problem on the first connection, turn on the ignore-certificate option in the API settings (a bridge on a home network presents a certificate that browsers and HTTP libraries often do not recognise).",
    "caveats": "API v1 (username in the path) is simpler than CLIP v2 and still works, but Signify has marked it as deprecated — eventually you will have to move to /clip/v2/resource/light with the hue-application-key header (the same key, but light identifiers are UUIDs and brightness is given as a percentage, 0-100). Plain http:// is being phased out (from August, due to RED requirements) — use https:// only, and the bridge may present a certificate that needs to be trusted or excepted. Everything works on the local network only — away from home you need the Hue cloud with OAuth2 (a separate app registration). The bridge's IP address can change after a router restart unless you give it a DHCP reservation. Requests that come too often (more than about 10/s per light) are rejected by the bridge — when driving it from motion, rate-limit the trigger.",
    "actions": [
      {
        "name": "Pair the bridge (create a key)",
        "desc": "Creates the application key, once — press the link button on the bridge and run this action within 30 seconds, and the response will contain your username."
      },
      {
        "name": "Turn the light on at full brightness",
        "desc": "Turns on the selected light and sets maximum brightness (bri 254)."
      },
      {
        "name": "Turn the light off",
        "desc": "Turns off the selected light (for example on a tap of the capsule)."
      },
      {
        "name": "Brightness and colour from capsule motion",
        "desc": "Drives the light's brightness and colour from motion channel values — channel 0 scaled to 1-254 (bri), channel 1 to 0-65535 (hue)."
      }
    ]
  }
},
{
  "key": "wled",
  "needsCred": false,
  "name": "WLED — taśmy LED",
  "desc": "Sterowanie taśmami LED z WLED przez JSON API.",
  "verified": true,
  "baseUrlHint": "http://192.168.1.50  (albo http://wled-a1b2c3.local — sterownik w Twojej sieci lokalnej, zwykłe HTTP bez HTTPS)",
  "credential": "Brak — JSON API WLED nie ma żadnego logowania ani tokenu; wystarczy być w tej samej sieci Wi-Fi co sterownik. PIN w ustawieniach i hasło OTA chronią tylko panel konfiguracji i aktualizacje, nie endpoint /json/state.",
  "actions": [
    {
      "name": "Włącz / wyłącz taśmę",
      "desc": "Przełącza taśmę między stanem włączonym a wyłączonym (jedno wyzwolenie = jedno przełączenie).",
      "method": "POST",
      "path": "/json/state",
      "query": [],
      "headers": [
        [
          "Content-Type",
          "application/json"
        ]
      ],
      "bodyType": "json",
      "body": "{\"on\":\"t\",\"v\":true}"
    },
    {
      "name": "Ustaw kolor i jasność",
      "desc": "Włącza taśmę, ustawia jasność oraz kolor pierwszego segmentu z płynnym przejściem.",
      "method": "POST",
      "path": "/json/state",
      "query": [],
      "headers": [
        [
          "Content-Type",
          "application/json"
        ]
      ],
      "bodyType": "json",
      "body": "{\"on\":true,\"bri\":{{var.BRI}},\"tt\":4,\"seg\":[{\"id\":0,\"col\":[[{{var.R}},{{var.G}},{{var.B}}]]}]}"
    },
    {
      "name": "Wywołaj preset WLED",
      "desc": "Uruchamia zapisany w WLED preset o numerze podanym w zmiennej (np. „impreza”, „ciepłe światło”).",
      "method": "POST",
      "path": "/json/state",
      "query": [],
      "headers": [
        [
          "Content-Type",
          "application/json"
        ]
      ],
      "bodyType": "json",
      "body": "{\"on\":true,\"ps\":{{var.PRESET}}}"
    },
    {
      "name": "Jasność sterowana pochyleniem",
      "desc": "Ustawia jasność taśmy wprost z pochylenia kapsla — im mocniej przechylony, tym jaśniej.",
      "method": "POST",
      "path": "/json/state",
      "query": [],
      "headers": [
        [
          "Content-Type",
          "application/json"
        ]
      ],
      "bodyType": "json",
      "body": "{\"on\":true,\"bri\":{{pose.tilt}},\"tt\":1}"
    }
  ],
  "guidePL": "1. Upewnij się, że sterownik WLED jest podłączony do tej samej sieci Wi-Fi, co komputer z RibbitFlip (jeśli rozgłasza własną sieć „WLED-AP”, najpierw połącz się z nią, wejdź na http://4.3.2.1 i w zakładce „WiFi Settings” wpisz nazwę i hasło swojej domowej sieci).\n2. Znajdź adres IP sterownika. Najprościej: otwórz panel routera i poszukaj urządzenia o nazwie zaczynającej się od „wled”. Alternatywy: aplikacja mobilna „WLED” (sama wykrywa urządzenia i pokazuje IP) albo wpisanie w przeglądarce http://wled-xxxxxx.local — nazwę mDNS zobaczysz/ustawisz w „WiFi Settings”.\n3. Sprawdź adres w przeglądarce: wpisz http://ADRES_IP — powinien otworzyć się kolorowy panel WLED. Jeśli się otwiera, adres jest dobry.\n4. W RibbitFlip dodaj nowe API i w polu „baseUrl” wklej dokładnie: http://ADRES_IP (bez ukośnika na końcu, bez „s” w http). Sejf poświadczeń zostaw pusty — WLED nie wymaga żadnego klucza ani hasła.\n5. Ustaw zmienne używane przez akcje (sekcja zmiennych, {{var.*}}): BRI = jasność 0–255 (np. 180), R, G, B = składowe koloru 0–255 (np. 255 / 60 / 0 dla pomarańczu), PRESET = numer presetu z WLED (patrz krok 6).\n6. Numer presetu odczytasz w panelu WLED: zakładka „Presets”, każdy zapisany preset ma swój numer (1, 2, 3…). Zapisz najpierw ulubione ustawienie przyciskiem „+ Preset”, a potem wpisz jego numer do zmiennej PRESET.\n7. Podepnij akcje pod wyzwalacze kapsla: np. „Włącz / wyłącz taśmę” pod puknięcie, „Wywołaj preset WLED” pod obrót, „Ustaw kolor i jasność” pod gest przytrzymania.\n8. Akcję „Jasność sterowana pochyleniem” podłącz pod ciągłe wychylenie — wysyła surową wartość {{pose.tilt}} (0–90) jako jasność, więc taśma świeci maksymalnie ok. 35%. Jeśli chcesz pełny zakres, podmień w treści żądania {{pose.tilt}} na kanał przeskalowany do 0–255 (np. {{ch0}} z odpowiednio ustawionym zakresem w RibbitFlip).\n9. Kliknij „Testuj” przy akcji — jeśli taśma zareaguje, gotowe. Gdy nic się nie dzieje, sprawdź w kroku 3, czy panel WLED nadal otwiera się pod tym adresem (routery lubią zmieniać IP).\n10. Zalecane: w routerze przypisz sterownikowi WLED stały adres IP (rezerwacja DHCP), żeby konfiguracja nie przestała działać po restarcie sieci.",
  "caveats": "JSON API WLED nie ma uwierzytelniania — każdy w Twojej sieci może sterować taśmą; nigdy nie wystawiaj sterownika bezpośrednio do internetu (brak HTTPS, ruch jawny). Adres IP nadany przez DHCP potrafi się zmienić po restarcie routera — zrób rezerwację IP albo używaj nazwy wled-xxxxxx.local (mDNS bywa zawodne na niektórych routerach, w sieciach VLAN i na Androidzie). Numery presetów ({{var.PRESET}}) muszą istnieć w urządzeniu, inaczej nic się nie stanie. Wartość {{pose.tilt}} (0–90) jest wysyłana wprost jako „bri”, którego zakres to 0–255 — bez przeskalowania taśma nie osiągnie pełnej jasności. Bardzo częste wysyłanie żądań (kilkadziesiąt na sekundę) potrafi zamulić ESP8266 — ogranicz częstotliwość wyzwalacza ciągłego.",
  "en": {
    "name": "WLED — LED strips",
    "desc": "Control WLED LED strips through the JSON API.",
    "credential": "None — the WLED JSON API has no login and no token; you just have to be on the same Wi-Fi network as the controller. The PIN in the settings and the OTA password only protect the configuration panel and updates, not the /json/state endpoint.",
    "guide": "1. Make sure the WLED controller is connected to the same Wi-Fi network as the computer running RibbitFlip (if it is broadcasting its own \"WLED-AP\" network, first connect to it, go to http://4.3.2.1 and enter the name and password of your home network in the \"WiFi Settings\" tab).\n2. Find the controller's IP address. The easiest way: open your router's panel and look for a device whose name starts with \"wled\". Alternatives: the \"WLED\" mobile app (it discovers devices by itself and shows the IP), or typing http://wled-xxxxxx.local in a browser — you can see and set the mDNS name in \"WiFi Settings\".\n3. Check the address in a browser: enter http://IP_ADDRESS — the colourful WLED panel should open. If it does, the address is correct.\n4. In RibbitFlip add a new API and paste exactly this into the \"baseUrl\" field: http://IP_ADDRESS (no trailing slash, no \"s\" in http). Leave the credential vault empty — WLED requires no key or password.\n5. Set the variables used by the actions (the variables section, {{var.*}}): BRI = brightness 0–255 (for example 180), R, G, B = colour components 0–255 (for example 255 / 60 / 0 for orange), PRESET = the preset number from WLED (see step 6).\n6. You can read the preset number in the WLED panel: the \"Presets\" tab, where every saved preset has its own number (1, 2, 3…). First save your favourite setting with the \"+ Preset\" button, then enter its number into the PRESET variable.\n7. Assign the actions to capsule triggers: for example \"Turn the strip on / off\" to a tap, \"Call a WLED preset\" to a spin, \"Set colour and brightness\" to a hold gesture.\n8. Assign the \"Brightness driven by tilt\" action to a continuous tilt — it sends the raw {{pose.tilt}} value (0–90) as the brightness, so the strip only reaches about 35% of full output. If you want the full range, replace {{pose.tilt}} in the request body with a channel scaled to 0–255 (for example {{ch0}} with the range set accordingly in RibbitFlip).\n9. Click \"Test\" next to the action — if the strip reacts, you are done. If nothing happens, go back to step 3 and check that the WLED panel still opens at that address (routers like to change IPs).\n10. Recommended: give the WLED controller a fixed IP address in your router (a DHCP reservation), so the configuration does not break after the network restarts.",
    "caveats": "The WLED JSON API has no authentication — anyone on your network can control the strip; never expose the controller directly to the internet (no HTTPS, traffic in the clear). An IP address handed out by DHCP can change after a router restart — make an IP reservation or use the wled-xxxxxx.local name (mDNS can be unreliable on some routers, on VLAN networks and on Android). The preset numbers ({{var.PRESET}}) must exist on the device, otherwise nothing will happen. The {{pose.tilt}} value (0–90) is sent straight through as \"bri\", whose range is 0–255 — without scaling the strip will never reach full brightness. Sending requests very frequently (tens per second) can bog down an ESP8266 — limit the rate of the continuous trigger.",
    "actions": [
      {
        "name": "Turn the strip on / off",
        "desc": "Toggles the strip between on and off (one trigger = one toggle)."
      },
      {
        "name": "Set colour and brightness",
        "desc": "Turns the strip on and sets the brightness and the colour of the first segment with a smooth transition."
      },
      {
        "name": "Call a WLED preset",
        "desc": "Runs the preset saved in WLED under the number given in the variable (for example \"party\", \"warm light\")."
      },
      {
        "name": "Brightness driven by tilt",
        "desc": "Sets the strip's brightness straight from the capsule's tilt — the more it is tilted, the brighter it gets."
      }
    ]
  }
},
{
  "key": "telegram",
  "name": "Telegram — bot",
  "desc": "Wiadomości od bota Telegrama na czat albo kanał.",
  "verified": true,
  "baseUrlHint": "https://api.telegram.org",
  "credential": "Token bota z @BotFather (komenda /newbot) — długi ciąg typu 123456789:AAF... . W RibbitFlip zapisz go w sejfie jako poświadczenie typu „header/inne” o identyfikatorze TELEGRAM_BOT_TOKEN i używaj w ścieżce jako {{secret.TELEGRAM_BOT_TOKEN}}; Telegram wymaga tokenu w URL, nie w nagłówku.",
  "actions": [
    {
      "name": "Wyślij powiadomienie o wyzwoleniu",
      "desc": "Wysyła na Telegram krótką wiadomość z nazwą wyzwalacza, urządzeniem i godziną.",
      "method": "POST",
      "path": "/bot{{secret.TELEGRAM_BOT_TOKEN}}/sendMessage",
      "query": [],
      "headers": [
        [
          "Content-Type",
          "application/json"
        ]
      ],
      "bodyType": "json",
      "body": "{\"chat_id\":\"{{var.TELEGRAM_CHAT_ID}}\",\"text\":\"\\uD83D\\uDC38 {{trigger.label}} — {{device.name}} ({{ts.iso}})\"}"
    },
    {
      "name": "Wyślij odczyt ruchu (telemetria)",
      "desc": "Wysyła cichą wiadomość z aktualnym pochyleniem, pitch, roll i skrętem kapsla.",
      "method": "POST",
      "path": "/bot{{secret.TELEGRAM_BOT_TOKEN}}/sendMessage",
      "query": [],
      "headers": [
        [
          "Content-Type",
          "application/json"
        ]
      ],
      "bodyType": "json",
      "body": "{\"chat_id\":\"{{var.TELEGRAM_CHAT_ID}}\",\"parse_mode\":\"HTML\",\"disable_notification\":true,\"text\":\"<b>{{trigger.label}}<\/b>\\nPochylenie: {{pose.tilt}}\\u00B0\\nPitch: {{pose.pitch}}\\u00B0 | Roll: {{pose.roll}}\\u00B0\\nSkręt: {{pose.twist}}\\u00B0/s\\nCzas: {{ts.iso}}\"}"
    },
    {
      "name": "Wyślij stan liczników i kanałów",
      "desc": "Raportuje wartość licznika wyzwoleń oraz kanały ch0–ch3 jednym komunikatem.",
      "method": "POST",
      "path": "/bot{{secret.TELEGRAM_BOT_TOKEN}}/sendMessage",
      "query": [],
      "headers": [
        [
          "Content-Type",
          "application/json"
        ]
      ],
      "bodyType": "json",
      "body": "{\"chat_id\":\"{{var.TELEGRAM_CHAT_ID}}\",\"text\":\"Licznik: {{counter}}\\nch0={{ch0}} ch1={{ch1}} ch2={{ch2}} ch3={{ch3}}\\n({{api.name}} / {{action.name}}, {{ts.unix}})\"}"
    },
    {
      "name": "Test połączenia z botem (getMe)",
      "desc": "Sprawdza, czy token bota jest poprawny — zwraca dane bota, nic nie wysyła.",
      "method": "GET",
      "path": "/bot{{secret.TELEGRAM_BOT_TOKEN}}/getMe",
      "query": [],
      "headers": [],
      "bodyType": "none",
      "body": ""
    }
  ],
  "guidePL": "1. W Telegramie wyszukaj kontakt @BotFather (z niebieskim znaczkiem weryfikacji) i naciśnij START.\n2. Wyślij komendę /newbot. BotFather zapyta o nazwę bota (dowolna, np. „Kapsel RibbitFlip”), a potem o nazwę użytkownika — musi być unikalna i kończyć się na „bot” (np. kapsel_ribbitflip_bot).\n3. W odpowiedzi dostaniesz token po zdaniu „Use this token to access the HTTP API:” — ciąg typu 123456789:AAF-xxxxxxxxxxxxxxxxxxxxx. Skopiuj go w całości (bez spacji) i NIKOMU nie pokazuj.\n4. W RibbitFlip otwórz sejf poświadczeń i dodaj nowy wpis o identyfikatorze TELEGRAM_BOT_TOKEN, wklejając skopiowany token jako wartość. W polu adresu bazowego (baseUrl) API wpisz: https://api.telegram.org\n5. Teraz poznaj swój chat_id. Wejdź w Telegramie na czat ze SWOIM nowym botem (wyszukaj go po nazwie użytkownika), naciśnij START i napisz do niego zwykłą wiadomość, np. „hej”.\n6. W przeglądarce otwórz adres: https://api.telegram.org/bot<TWÓJ_TOKEN>/getUpdates — w miejsce <TWÓJ_TOKEN> wklej token (słowo „bot” na początku zostaw!). Zobaczysz tekst JSON.\n7. W tym tekście znajdź fragment \"chat\":{\"id\":123456789 — ta liczba przy \"id\" wewnątrz \"chat\" to Twój chat_id. Skopiuj ją (dla grup zaczyna się od minusa, np. -1001234567890 — minus też kopiujesz).\n8. W RibbitFlip dodaj zmienną o nazwie TELEGRAM_CHAT_ID i wklej tam tę liczbę. Akcje z tego szablonu używają jej jako {{var.TELEGRAM_CHAT_ID}}.\n9. Uruchom akcję „Test połączenia z botem (getMe)” — jeśli odpowiedź zawiera \"ok\":true, token działa. Potem odpal „Wyślij powiadomienie o wyzwoleniu” i sprawdź, czy wiadomość dotarła na Telegram.\n10. Na koniec przypisz wybraną akcję do wyzwalacza kapsla (np. mocne pochylenie) i przetestuj realnym ruchem.",
  "caveats": "Token bota nie wygasa sam, ale kto go pozna, przejmie bota — trzymaj go tylko w sejfie RibbitFlip; w razie wycieku zrób /revoke u @BotFather (stary token przestanie działać, trzeba wkleić nowy). Bot NIE może napisać pierwszy: musisz najpierw sam nacisnąć START w czacie z botem, inaczej sendMessage zwróci błąd 403 „bot can't initiate conversation”. Metoda getUpdates pokazuje tylko świeże wiadomości (ok. 24 h) i przestanie działać, jeśli do bota ustawisz webhooka. Limity Telegrama: ok. 30 wiadomości na sekundę łącznie i ok. 1 wiadomość na sekundę do jednego czatu — przy szybkich wyzwalaczach dodaj opóźnienie, bo dostaniesz błąd 429. W grupach domyślnie działa „tryb prywatności” bota (nie widzi cudzych wiadomości) — wyłączysz go w @BotFather: /mybots → bot → Bot Settings → Group Privacy. API jest bezpłatne.",
  "en": {
    "name": "Telegram — bot",
    "desc": "Messages from a Telegram bot to a chat or a channel.",
    "credential": "The bot token from @BotFather (the /newbot command) — a long string like 123456789:AAF... . In RibbitFlip store it in the vault as a \"header/other\" credential with the ID TELEGRAM_BOT_TOKEN and use it in the path as {{secret.TELEGRAM_BOT_TOKEN}}; Telegram requires the token in the URL, not in a header.",
    "guide": "1. In Telegram search for the contact @BotFather (with the blue verification badge) and press START.\n2. Send the command /newbot. BotFather will ask for the bot's name (anything, for example \"RibbitFlip Capsule\") and then for a username — it must be unique and end with \"bot\" (for example puck_ribbitflip_bot).\n3. You will get the token back after the line \"Use this token to access the HTTP API:\" — a string like 123456789:AAF-xxxxxxxxxxxxxxxxxxxxx. Copy it whole (no spaces) and show it to NOBODY.\n4. In RibbitFlip open the credential vault and add a new entry with the ID TELEGRAM_BOT_TOKEN, pasting the copied token as its value. In the app's base address (baseUrl) field type: https://api.telegram.org\n5. Now find your chat_id. In Telegram open the chat with YOUR new bot (search for it by its username), press START and send it an ordinary message, for example \"hi\".\n6. In your browser open: https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates — replace <YOUR_TOKEN> with your token (keep the word \"bot\" at the beginning!). You will see some JSON text.\n7. In that text find the fragment \"chat\":{\"id\":123456789 — the number next to \"id\" inside \"chat\" is your chat_id. Copy it (for groups it starts with a minus, for example -1001234567890 — copy the minus too).\n8. In RibbitFlip add a variable named TELEGRAM_CHAT_ID and paste that number into it. The actions in this template use it as {{var.TELEGRAM_CHAT_ID}}.\n9. Run the \"Test the bot connection (getMe)\" action — if the response contains \"ok\":true, the token works. Then fire \"Send a trigger notification\" and check that the message reached Telegram.\n10. Finally, assign the action you picked to a capsule trigger (for example a hard tilt) and test it with real movement.",
    "caveats": "The bot token does not expire on its own, but anyone who learns it takes over your bot — keep it in the RibbitFlip vault only; if it leaks, run /revoke with @BotFather (the old token stops working and you have to paste in the new one). The bot CANNOT message you first: you must press START in the chat with the bot yourself, otherwise sendMessage returns error 403 \"bot can't initiate conversation\". The getUpdates method only shows recent messages (about 24 h) and stops working if you set a webhook on the bot. Telegram limits: about 30 messages per second in total and about 1 message per second to a single chat — add a delay for fast triggers, or you will get error 429. In groups the bot's \"privacy mode\" is on by default (it cannot see other people's messages) — turn it off in @BotFather: /mybots → bot → Bot Settings → Group Privacy. The API is free.",
    "actions": [
      {
        "name": "Send a trigger notification",
        "desc": "Sends a short Telegram message with the trigger name, the device and the time."
      },
      {
        "name": "Send a motion reading (telemetry)",
        "desc": "Sends a silent message with the capsule's current tilt, pitch, roll and twist."
      },
      {
        "name": "Send counter and channel state",
        "desc": "Reports the trigger counter value and channels ch0–ch3 in a single message."
      },
      {
        "name": "Test the bot connection (getMe)",
        "desc": "Checks whether the bot token is valid — it returns the bot's details and sends nothing."
      }
    ]
  }
},
{
  "key": "sendgrid",
  "name": "SendGrid — e-mail",
  "desc": "Wysyłka e-maili przez API SendGrid.",
  "verified": true,
  "baseUrlHint": "https://api.sendgrid.com",
  "credential": "Klucz API SendGrid (typ: bearer) — tworzysz go w panelu SendGrid w Settings → API Keys, uprawnienie „Restricted Access” z włączonym Mail Send w zupełności wystarcza. Klucz zaczyna się od „SG.”, pokazuje się tylko RAZ przy tworzeniu, więc od razu wklej go do sejfu RibbitFlip (Authorization: Bearer).",
  "actions": [
    {
      "name": "Wyślij alert e-mail",
      "desc": "Wysyła krótkiego maila z etykietą wyzwalacza i czasem — szybkie powiadomienie „kapsel wykrył zdarzenie”.",
      "method": "POST",
      "path": "/v3/mail/send",
      "query": [],
      "headers": [
        [
          "Content-Type",
          "application/json"
        ]
      ],
      "bodyType": "json",
      "body": "{\n  \"personalizations\": [{ \"to\": [{ \"email\": \"{{var.DO_EMAIL}}\" }] }],\n  \"from\": { \"email\": \"{{var.OD_EMAIL}}\", \"name\": \"RibbitFlip\" },\n  \"subject\": \"RibbitFlip: {{trigger.label}}\",\n  \"content\": [{ \"type\": \"text/plain\", \"value\": \"Wyzwalacz: {{trigger.label}}\\nUrzadzenie: {{device.name}}\\nCzas: {{ts.iso}}\" }]\n}"
    },
    {
      "name": "Wyślij odczyt czujnika",
      "desc": "Wysyła maila z aktualnymi kątami kapsla (pochylenie, pitch, roll, skręt) — do zapisu pomiaru na skrzynce.",
      "method": "POST",
      "path": "/v3/mail/send",
      "query": [],
      "headers": [
        [
          "Content-Type",
          "application/json"
        ]
      ],
      "bodyType": "json",
      "body": "{\n  \"personalizations\": [{ \"to\": [{ \"email\": \"{{var.DO_EMAIL}}\" }] }],\n  \"from\": { \"email\": \"{{var.OD_EMAIL}}\", \"name\": \"RibbitFlip\" },\n  \"subject\": \"Odczyt {{device.name}} — pochylenie {{pose.tilt}}\\u00b0\",\n  \"content\": [{ \"type\": \"text/plain\", \"value\": \"tilt: {{pose.tilt}}\\npitch: {{pose.pitch}}\\nroll: {{pose.roll}}\\ntwist: {{pose.twist}}\\nch0: {{ch0}}  ch1: {{ch1}}  ch2: {{ch2}}\\nczas: {{ts.iso}}\" }]\n}"
    },
    {
      "name": "Wyślij raport HTML z licznikiem",
      "desc": "Ładniejsza wiadomość HTML z numerem kolejnego wyzwolenia — przydatna, gdy zliczasz powtórzenia gestu.",
      "method": "POST",
      "path": "/v3/mail/send",
      "query": [],
      "headers": [
        [
          "Content-Type",
          "application/json"
        ]
      ],
      "bodyType": "json",
      "body": "{\n  \"personalizations\": [{ \"to\": [{ \"email\": \"{{var.DO_EMAIL}}\" }] }],\n  \"from\": { \"email\": \"{{var.OD_EMAIL}}\", \"name\": \"RibbitFlip\" },\n  \"subject\": \"RibbitFlip #{{counter}} — {{trigger.label}}\",\n  \"content\": [{ \"type\": \"text/html\", \"value\": \"<h3>{{trigger.label}}<\/h3><p>Wyzwolenie nr <b>{{counter}}<\/b> z urzadzenia <b>{{device.name}}<\/b>.<\/p><p>Pochylenie: {{pose.tilt}}&deg;<br>Czas: {{ts.iso}}<\/p>\" }]\n}"
    }
  ],
  "guidePL": "1. Wejdź na https://sendgrid.com i zaloguj się (lub załóż konto — uwaga: darmowy plan został wycofany, nowe konta dostają tylko 60-dniowy okres próbny).\n2. W panelu przejdź do Settings → Sender Authentication → Single Sender Verification i kliknij „Verify a Single Sender”. Wpisz adres nadawcy (np. swój prywatny e-mail), nazwę i adres pocztowy, zapisz. SendGrid wyśle link weryfikacyjny na ten adres — kliknij go. Bez tego kroku wysyłka zwraca błąd 403.\n3. Przejdź do Settings → API Keys → „Create API Key”. Nazwij klucz (np. „RibbitFlip”), wybierz „Restricted Access” i suwakiem włącz pełny dostęp dla „Mail Send”. Zatwierdź.\n4. Skopiuj wyświetlony klucz (zaczyna się od „SG.”). Pokazuje się TYLKO RAZ — jeśli go zgubisz, trzeba utworzyć nowy.\n5. W RibbitFlip w edytorze API ustaw pole baseUrl na: https://api.sendgrid.com\n6. W sejfie RibbitFlip dodaj nowe poświadczenie typu „bearer”, wklej skopiowany klucz i przypisz je do tego API. RibbitFlip sam doda nagłówek Authorization: Bearer …\n7. W zmiennych API dodaj dwie pozycje: OD_EMAIL — adres zweryfikowany przed chwilą (nadawca), oraz DO_EMAIL — adres, na który mają przychodzić powiadomienia (może być ten sam).\n8. Wybierz jedną z gotowych akcji (np. „Wyślij alert e-mail”) i kliknij test. Poprawna odpowiedź to kod 202 i PUSTA treść — to normalne, mail jest w kolejce.\n9. Podłącz akcję pod wyzwalacz kapsla (np. mocne puknięcie albo przekroczenie pochylenia) i sprawdź skrzynkę. Zajrzyj też do folderu SPAM przy pierwszej wiadomości.\n10. Jeśli mail nie dotarł: w panelu SendGrid otwórz Activity Feed — pokaże, czy wiadomość została przyjęta, odbita czy zablokowana.",
  "caveats": "SendGrid wycofał stały darmowy plan (retirement ogłoszony 27.05.2025, obowiązuje od lipca 2025) — nowe konta mają jedynie 60-dniowy trial ze 100 mailami dziennie, potem wymagany jest płatny plan od ok. 19,95 USD/mies. Do użytku osobistego bez opłat lepszymi alternatywami są Brevo (300 maili/dobę), Resend (3000/mies.) lub Amazon SES; endpoint /v3/mail/send u nich nie zadziała — mają własne API. Nadawca („from”) musi być zweryfikowany (Single Sender lub Domain Authentication), inaczej 403. Sukces to kod 202 z pustym ciałem odpowiedzi — brak treści nie oznacza błędu. Nie wpisuj klucza SG.… na stałe w nagłówek ani w treść żądania — trzymaj go w sejfie. Konta w regionie EU używają innej bazy: https://api.eu.sendgrid.com. Uwaga na częstotliwość wyzwalaczy — ruchowy kontroler potrafi wystrzelić dziesiątki żądań, a limit dzienny i reputacja nadawcy szybko dadzą o sobie znać.",
  "en": {
    "name": "SendGrid — e-mail",
    "desc": "Sending e-mails through the SendGrid API.",
    "credential": "A SendGrid API key (type: bearer) — create it in the SendGrid panel under Settings → API Keys; \"Restricted Access\" with Mail Send enabled is entirely enough. The key starts with \"SG.\" and is shown only ONCE when created, so paste it into the RibbitFlip vault right away (Authorization: Bearer).",
    "guide": "1. Go to https://sendgrid.com and sign in (or create an account — note: the free plan has been retired, new accounts only get a 60-day trial).\n2. In the panel go to Settings → Sender Authentication → Single Sender Verification and click \"Verify a Single Sender\". Enter the sender address (your personal email, for example), a name and a postal address, then save. SendGrid sends a verification link to that address — click it. Without this step sending returns a 403 error.\n3. Go to Settings → API Keys → \"Create API Key\". Name the key (e.g. \"RibbitFlip\"), choose \"Restricted Access\" and use the slider to grant full access for \"Mail Send\". Confirm.\n4. Copy the key that is shown (it starts with \"SG.\"). It is displayed ONLY ONCE — if you lose it, you have to create a new one.\n5. In the RibbitFlip app editor set the baseUrl field to: https://api.sendgrid.com\n6. In the RibbitFlip vault add a new \"bearer\" credential, paste the copied key and assign it to this app. RibbitFlip adds the Authorization: Bearer … header for you.\n7. In the app variables add two entries: OD_EMAIL — the address you just verified (the sender), and DO_EMAIL — the address that should receive the notifications (it can be the same one).\n8. Pick one of the ready-made actions (e.g. \"Send email alert\") and click test. A correct response is status 202 with an EMPTY body — that is normal, the message is queued.\n9. Attach the action to a capsule trigger (a hard tap or a tilt threshold) and check your inbox. Also look in the SPAM folder for the first message.\n10. If the email does not arrive: open the Activity Feed in the SendGrid panel — it shows whether the message was accepted, bounced or blocked.",
    "caveats": "SendGrid has retired its permanent free plan (retirement announced 27 May 2025, effective July 2025) — new accounts only get a 60-day trial with 100 emails per day, after which a paid plan from about USD 19.95/month is required. For free personal use, better alternatives are Brevo (300 emails/day), Resend (3,000/month) or Amazon SES; the /v3/mail/send endpoint will not work with them — they have their own APIs. The sender (\"from\") must be verified (Single Sender or Domain Authentication), otherwise you get a 403. Success is status 202 with an empty response body — the missing content does not mean an error. Do not hard-code the SG.… key into a header or a request body — keep it in the vault. Accounts in the EU region use a different base address: https://api.eu.sendgrid.com. Watch out for how often your triggers fire — a motion controller can easily fire off dozens of requests, and the daily limit and your sender reputation are very real.",
    "actions": [
      {
        "name": "Send email alert",
        "desc": "Sends a short email with the trigger label and the time — a quick \"the capsule detected an event\" notification."
      },
      {
        "name": "Send sensor reading",
        "desc": "Sends an email with the capsule's current angles (tilt, pitch, roll, twist) — to keep a record of the measurement in your inbox."
      },
      {
        "name": "Send HTML report with counter",
        "desc": "A nicer HTML message with the number of the trigger event — useful when you are counting gesture repetitions."
      }
    ]
  }
},
{
  "key": "joke",
  "needsCred": false,
  "name": "Losowy żart / demo bez konta",
  "desc": "Losowy żart z JokeAPI — do testów, bez żadnych kluczy.",
  "verified": true,
  "baseUrlHint": "https://icanhazdadjoke.com",
  "credential": "Brak — icanhazdadjoke.com nie wymaga żadnego klucza ani konta (potwierdzone w oficjalnej dokumentacji API oraz testem na żywo). Autor prosi tylko o ustawienie własnego nagłówka User-Agent identyfikującego aplikację.",
  "actions": [
    {
      "name": "Losowy żart",
      "desc": "Pobiera jeden losowy żart w formacie JSON — idealne do sprawdzenia, czy wyzwalacz w ogóle strzela.",
      "method": "GET",
      "path": "/",
      "query": [],
      "headers": [
        [
          "Accept",
          "application/json"
        ],
        [
          "User-Agent",
          "RibbitFlip/{{device.name}} (uzytek osobisty)"
        ]
      ],
      "bodyType": "none",
      "body": ""
    },
    {
      "name": "Żart na wybrany temat",
      "desc": "Szuka żartu zawierającego słowo ze zmiennej {{var.TEMAT}} i zwraca jeden wynik.",
      "method": "GET",
      "path": "/search",
      "query": [
        [
          "term",
          "{{var.TEMAT}}"
        ],
        [
          "limit",
          "1"
        ]
      ],
      "headers": [
        [
          "Accept",
          "application/json"
        ],
        [
          "User-Agent",
          "RibbitFlip/{{device.name}} (uzytek osobisty)"
        ]
      ],
      "bodyType": "none",
      "body": ""
    },
    {
      "name": "Kolejny żart za każdym puknięciem",
      "desc": "Ten sam temat, ale numer strony rośnie z licznikiem {{counter}}, więc każde wyzwolenie daje inny żart.",
      "method": "GET",
      "path": "/search",
      "query": [
        [
          "term",
          "{{var.TEMAT}}"
        ],
        [
          "limit",
          "1"
        ],
        [
          "page",
          "{{counter}}"
        ]
      ],
      "headers": [
        [
          "Accept",
          "application/json"
        ],
        [
          "User-Agent",
          "RibbitFlip/{{device.name}} (uzytek osobisty)"
        ]
      ],
      "bodyType": "none",
      "body": ""
    },
    {
      "name": "Echo pozycji kapsla (test placeholderów)",
      "desc": "Wysyła pochylenie i skręt jako parametry do publicznego echa httpbin — służy wyłącznie do podejrzenia, jakie wartości naprawdę lecą z kapsla.",
      "method": "GET",
      "path": "/get",
      "query": [
        [
          "tilt",
          "{{pose.tilt}}"
        ],
        [
          "pitch",
          "{{pose.pitch}}"
        ],
        [
          "roll",
          "{{pose.roll}}"
        ],
        [
          "twist",
          "{{pose.twist}}"
        ],
        [
          "trigger",
          "{{trigger.label}}"
        ],
        [
          "ts",
          "{{ts.iso}}"
        ]
      ],
      "headers": [
        [
          "Accept",
          "application/json"
        ]
      ],
      "bodyType": "none",
      "body": ""
    }
  ],
  "guidePL": "1. W RibbitFlip otwórz listę API i dodaj nowe API o nazwie „Żarty (demo)”.\n2. W polu adresu bazowego (baseUrl) wklej dokładnie: https://icanhazdadjoke.com — bez ukośnika na końcu.\n3. Nie wypełniaj sejfu poświadczeń — ta usługa nie ma logowania ani klucza. Pole „poświadczenie” zostaw puste / „brak”.\n4. Dodaj zmienną tekstową o nazwie TEMAT (używaną jako {{var.TEMAT}}) i wpisz w niej jedno angielskie słowo, np. cat, dog, food. Żarty są po angielsku, więc polskie słowo nic nie znajdzie.\n5. Dodaj akcję „Losowy żart”: metoda GET, ścieżka /, nagłówek Accept o wartości application/json oraz nagłówek User-Agent (np. RibbitFlip/{{device.name}} (uzytek osobisty)). Bez nagłówka Accept usługa odda zwykły tekst zamiast JSON.\n6. Kliknij „Testuj” — w odpowiedzi powinno pojawić się pole \"joke\" z treścią dowcipu i \"status\": 200.\n7. Dodaj akcję „Żart na wybrany temat”: GET, ścieżka /search, parametry zapytania term = {{var.TEMAT}} oraz limit = 1, te same dwa nagłówki.\n8. Dodaj akcję „Kolejny żart za każdym puknięciem”: to samo co wyżej plus parametr page = {{counter}} — dzięki temu każde wyzwolenie zwraca inny dowcip (jeśli licznik przekroczy liczbę stron, usługa odda pustą listę — wyzeruj licznik).\n9. Przypisz akcje do wyzwalaczy kapsla, np. mocne puknięcie = losowy żart, przechył w bok = żart na temat.\n10. Chcesz zamiast żartów kocie ciekawostki? Utwórz drugie API z adresem bazowym https://catfact.ninja i akcją GET /fact (opcjonalny parametr max_length, np. 100). Trzecia sprawdzona opcja: https://uselessfacts.jsph.pl z akcją GET /api/v2/facts/random i parametrem language = en. Obie też bez konta i bez klucza.\n11. Akcja „Echo pozycji kapsla” wymaga osobnego API z adresem bazowym https://httpbin.org — użyj jej tylko wtedy, gdy chcesz podejrzeć, jakie liczby podstawiają się pod {{pose.*}}.",
  "caveats": "Wszystkie trzy usługi (icanhazdadjoke.com, catfact.ninja, uselessfacts.jsph.pl) sprawdzone na żywo 2026-08-04 — HTTP 200, bez klucza. To jednak darmowe projekty hobbystyczne: mogą zniknąć, spowolnić lub zacząć limitować ruch bez zapowiedzi, więc nie opieraj o nie niczego ważnego. Autor icanhazdadjoke prosi o własny nagłówek User-Agent — bez niego ryzykujesz blokadą. Bez nagłówka Accept: application/json dostaniesz zwykły tekst. Treści są po angielsku i losowe (dad jokes) — mogą być niesmaczne — w miejscu publicznym nie puszczaj ich bez filtra. Endpoint /search ma limit maks. 30 wyników na stronę, a przy zbyt dużym parametrze page zwraca pustą listę. Akcja z httpbin.org wysyła dane o ruchu kapsla do zewnętrznego, publicznego serwisu testowego — używaj jej tylko do debugowania i nie wstawiaj tam nic prywatnego.",
  "en": {
    "name": "Random joke / demo with no account",
    "desc": "A random joke from JokeAPI — for testing, with no keys at all.",
    "credential": "None — icanhazdadjoke.com needs no key and no account (confirmed in the official API documentation and by a live test). The author only asks that you set your own User-Agent header identifying your app.",
    "guide": "1. In RibbitFlip open the list of apps and add a new one named \"Jokes (demo)\".\n2. In the base address (baseUrl) field paste exactly: https://icanhazdadjoke.com — with no trailing slash.\n3. Do not fill in the credential vault — this service has no sign-in and no key. Leave the \"credential\" field empty / \"none\".\n4. Add a text variable named TEMAT (used as {{var.TEMAT}}) and type one English word into it, for example cat, dog, food. The jokes are in English, so a non-English word will find nothing.\n5. Add the \"Random joke\" action: method GET, path /, an Accept header with the value application/json and a User-Agent header (for example RibbitFlip/{{device.name}} (personal use)). Without the Accept header the service returns plain text instead of JSON.\n6. Click \"Test\" — the response should contain a \"joke\" field with the joke text and \"status\": 200.\n7. Add the \"Joke on a chosen topic\" action: GET, path /search, query parameters term = {{var.TEMAT}} and limit = 1, the same two headers.\n8. Add the \"A new joke on every tap\" action: the same as above plus the parameter page = {{counter}} — that way every trigger returns a different joke (if the counter goes past the number of pages, the service returns an empty list — reset the counter).\n9. Assign the actions to capsule triggers, for example a hard tap = random joke, a sideways tilt = joke on a topic.\n10. Want cat facts instead of jokes? Create a second app with the base address https://catfact.ninja and a GET /fact action (optional max_length parameter, for example 100). A third verified option: https://uselessfacts.jsph.pl with a GET /api/v2/facts/random action and the parameter language = en. Both are also account-free and key-free.\n11. The \"Echo the capsule position\" action needs a separate app with the base address https://httpbin.org — use it only when you want to see what numbers are actually being substituted for {{pose.*}}.",
    "caveats": "All three services (icanhazdadjoke.com, catfact.ninja, uselessfacts.jsph.pl) were tested live on 2026-08-04 — HTTP 200, no key. They are, however, free hobby projects: they can disappear, slow down or start throttling traffic without warning, so do not build anything important on them. The author of icanhazdadjoke asks for your own User-Agent header — without it you risk being blocked. Without the Accept: application/json header you will get plain text. The content is in English and random (dad jokes) — it can be tasteless, so do not run it unfiltered in a public place. The /search endpoint is limited to max. 30 results per page, and too high a page parameter returns an empty list. The httpbin.org action sends your capsule's motion data to an external, public test service — use it for debugging only and never put anything private in it.",
    "actions": [
      {
        "name": "Random joke",
        "desc": "Fetches one random joke as JSON — perfect for checking whether a trigger fires at all."
      },
      {
        "name": "Joke on a chosen topic",
        "desc": "Searches for a joke containing the word from the {{var.TEMAT}} variable and returns one result."
      },
      {
        "name": "A new joke on every tap",
        "desc": "The same topic, but the page number grows with the {{counter}}, so every trigger gives a different joke."
      },
      {
        "name": "Echo the capsule position (placeholder test)",
        "desc": "Sends the tilt and twist as parameters to the public httpbin echo — it exists purely so you can see what values the capsule really sends."
      }
    ]
  }
},
{
  "key": "twitch",
  "name": "Twitch — klip, znacznik, tytuł",
  "desc": "Puknięcie kapsla robi klip z ostatnich sekund streamu, stawia znacznik albo zmienia tytuł kanału.",
  "verified": false,
  "baseUrlHint": "https://api.twitch.tv",
  "credential": "Dwie rzeczy, obie z portalu dev.twitch.tv. TOKEN dostępu użytkownika (OAuth) trzymaj w sejfie jako poświadczenie typu „bearer” — poleci nagłówkiem Authorization: Bearer …. CLIENT ID nie jest sekretem (Twitch pokazuje go w konsoli aplikacji), więc zapisz go jako zmienną {{var.TWITCH_CLIENT_ID}} i wysyłaj nagłówkiem Client-Id wspólnym dla całej aplikacji. Twitch wymaga OBU naraz i sprawdza, czy Client-Id zgadza się z tym zaszytym w tokenie.",
  "actions": [
    {
      "name": "Utwórz klip",
      "desc": "Robi klip z ostatnich sekund transmisji — kanał musi być na żywo. Zakres: clips:edit.",
      "method": "POST",
      "path": "/helix/clips",
      "query": [
        [
          "broadcaster_id",
          "{{var.TWITCH_BROADCASTER_ID}}"
        ]
      ],
      "headers": [],
      "bodyType": "none",
      "body": ""
    },
    {
      "name": "Znacznik na strumieniu",
      "desc": "Stawia znacznik w bieżącej chwili transmisji, żeby łatwo wrócić do niej przy montażu. Zakres: channel:manage:broadcast.",
      "method": "POST",
      "path": "/helix/streams/markers",
      "query": [],
      "headers": [
        [
          "Content-Type",
          "application/json"
        ]
      ],
      "bodyType": "json",
      "body": "{\n  \"user_id\": \"{{var.TWITCH_BROADCASTER_ID}}\",\n  \"description\": \"RibbitFlip: {{trigger.label}}\"\n}"
    },
    {
      "name": "Zmień tytuł strumienia",
      "desc": "Ustawia tytuł kanału na wartość ze zmiennej {{var.TWITCH_TYTUL}}. Zakres: channel:manage:broadcast.",
      "method": "PATCH",
      "path": "/helix/channels",
      "query": [
        [
          "broadcaster_id",
          "{{var.TWITCH_BROADCASTER_ID}}"
        ]
      ],
      "headers": [
        [
          "Content-Type",
          "application/json"
        ]
      ],
      "bodyType": "json",
      "body": "{\n  \"title\": \"{{var.TWITCH_TYTUL}}\"\n}"
    }
  ],
  "guidePL": "1. Wejdź na https://dev.twitch.tv/console/apps i zarejestruj własną aplikację (dowolna nazwa, adres przekierowania http://localhost:3000, kategoria „Application Integration”). Twitch pokaże Client ID — to nie jest sekret.\n2. Zdobądź TOKEN DOSTĘPU UŻYTKOWNIKA dla swojego kanału, przechodząc przez logowanie OAuth swojej aplikacji i zgadzając się na zakresy: clips:edit (klipy) oraz channel:manage:broadcast (znaczniki i tytuł). Token aplikacji (client credentials) tu NIE wystarczy — Twitch musi wiedzieć, KTO robi klip.\n3. W RibbitFlip, w karcie „Sejf poświadczeń”, dodaj poświadczenie typu „Token (Bearer)” i wklej w nie token (bez słowa „oauth:” i bez „Bearer”).\n4. W pod-zakładce „Ustawienia i test” tej aplikacji ustaw Adres bazowy na https://api.twitch.tv, wybierz to poświadczenie i dodaj nagłówek wspólny: nazwa Client-Id, wartość {{var.TWITCH_CLIENT_ID}}.\n5. W karcie „Zmienne” uzupełnij TWITCH_CLIENT_ID (z konsoli aplikacji), TWITCH_BROADCASTER_ID (numeryczny identyfikator Twojego kanału — nie nazwa użytkownika; zwraca go GET /helix/users?login=twoja_nazwa) oraz TWITCH_TYTUL, jeśli chcesz zmieniać tytuł.\n6. Sprawdź: włącz transmisję, kliknij „▶ Wyślij” przy „Utwórz klip”. Odpowiedź 202 i pole edit_url oznaczają sukces; wynik zobaczysz w karcie „Dziennik wysyłek”.\n7. Podepnij akcje do wyzwalaczy: mocne puknięcie = klip, przechył w bok = znacznik. Ustaw sensowny odstęp minimalny (np. 5000 ms), bo Twitch limituje tempo żądań.",
  "caveats": "Napisane z oficjalnej dokumentacji Twitcha (dev.twitch.tv/docs/api/reference), nie sprawdzone na żywym koncie — stąd plakietka „niezweryfikowane”. Klip i znacznik działają WYŁĄCZNIE, gdy kanał jest na żywo: poza transmisją Twitch odpowiada błędem, a nie ciszą. Token dostępu użytkownika WYGASA (zwykle po kilku godzinach) — po wygaśnięciu akcje zaczną zwracać 401 i trzeba wkleić do sejfu nowy; RibbitFlip nie odświeża tokenów sam, bo wymagałoby to przechowywania Twojego client secret. Client-Id musi zgadzać się z aplikacją, dla której wydano token, inaczej Twitch odpowie 401. Opis znacznika ma limit 140 znaków. Utworzenie klipu jest asynchroniczne: 202 znaczy „przyjęto”, a gotowy klip pojawia się chwilę później. Twitch limituje tempo żądań per token — nie podpinaj tych akcji pod wyzwalacz strzelający kilka razy na sekundę.",
  "en": {
    "name": "Twitch — clip, marker, title",
    "desc": "A tap of the capsule clips the last seconds of your stream, drops a marker or changes the channel title.",
    "credential": "Two things, both from the dev.twitch.tv portal. Keep the user ACCESS TOKEN (OAuth) in the vault as a “bearer” credential — it travels in the Authorization: Bearer … header. The CLIENT ID is not a secret (Twitch shows it in your app console), so store it as the variable {{var.TWITCH_CLIENT_ID}} and send it in a Client-Id header shared by the whole application. Twitch requires BOTH and checks that the Client-Id matches the one baked into the token.",
    "guide": "1. Go to https://dev.twitch.tv/console/apps and register your own application (any name, redirect address http://localhost:3000, category “Application Integration”). Twitch shows you a Client ID — that one is not a secret.\n2. Get a USER ACCESS TOKEN for your channel by going through your application's OAuth sign-in and granting the scopes clips:edit (clips) and channel:manage:broadcast (markers and title). An app token (client credentials) is NOT enough here — Twitch has to know WHO is making the clip.\n3. In RibbitFlip, in the “Credential vault” card, add a “Token (Bearer)” credential and paste the token into it (without the “oauth:” prefix and without “Bearer”).\n4. In this application's “Settings & test” sub-tab set the base URL to https://api.twitch.tv, pick that credential and add a shared header: name Client-Id, value {{var.TWITCH_CLIENT_ID}}.\n5. In the “Variables” card fill in TWITCH_CLIENT_ID (from the app console), TWITCH_BROADCASTER_ID (the numeric id of your channel — not the user name; GET /helix/users?login=your_name returns it) and TWITCH_TYTUL if you want to change the title.\n6. Try it: go live, then press “▶ Send” next to “Create clip”. A 202 answer with an edit_url field means success; the result appears in the “Send log” card.\n7. Bind the actions to triggers: a hard tap = clip, a sideways tilt = marker. Set a sensible minimum interval (e.g. 5000 ms) — Twitch rate-limits requests.",
    "caveats": "Written from the official Twitch documentation (dev.twitch.tv/docs/api/reference), not tested against a live account — hence the “unverified” badge. Clips and markers work ONLY while the channel is live: off air Twitch answers with an error rather than silence. A user access token EXPIRES (usually after a few hours) — once it does the actions start returning 401 and you have to paste a new one into the vault; RibbitFlip does not refresh tokens by itself, because that would mean storing your client secret. The Client-Id must match the application the token was issued for, or Twitch answers 401. A marker description is limited to 140 characters. Creating a clip is asynchronous: 202 means “accepted”, and the finished clip shows up a moment later. Twitch rate-limits per token — do not bind these actions to a trigger that fires several times a second.",
    "actions": [
      {
        "name": "Create clip",
        "desc": "Clips the last seconds of the broadcast — the channel must be live. Scope: clips:edit."
      },
      {
        "name": "Marker on the stream",
        "desc": "Drops a marker at the current point of the broadcast so you can find it while editing. Scope: channel:manage:broadcast."
      },
      {
        "name": "Change the stream title",
        "desc": "Sets the channel title to the value of {{var.TWITCH_TYTUL}}. Scope: channel:manage:broadcast."
      }
    ]
  }
},
{
  "key": "obs",
  "name": "OBS Studio — sceny, nagrywanie, mikrofon",
  "desc": "Ruch kapsla przełącza scenę w OBS, włącza nagrywanie albo wycisza mikrofon. Przez obs-websocket, nie HTTP.",
  "verified": false,
  "transport": "ws",
  "baseUrlHint": "obs-websocket://127.0.0.1:4455",
  "credential": "Poświadczenie typu „Hasło OBS (WebSocket)”. Hasło znajdziesz w OBS: Narzędzia → Ustawienia serwera WebSocket → „Pokaż informacje o połączeniu”. Wklej je do sejfu RibbitFlip, a potem wybierz w karcie „OBS Studio” u góry tego ekranu i kliknij „Połącz”. Do OBS-a nie jedzie samo hasło, tylko podpis wyliczony z niego w Twojej przeglądarce. Jeśli w OBS wyłączyłeś uwierzytelnianie, poświadczenie nie jest potrzebne.",
  "actions": [
    {
      "name": "Przełącz scenę",
      "desc": "Ustawia scenę o nazwie ze zmiennej {{var.OBS_SCENA}} jako scenę na antenie (Program).",
      "requestType": "SetCurrentProgramScene",
      "bodyType": "json",
      "body": "{\n  \"sceneName\": \"{{var.OBS_SCENA}}\"\n}"
    },
    {
      "name": "Rozpocznij nagrywanie",
      "desc": "Włącza nagrywanie do pliku — to samo, co przycisk „Rozpocznij nagrywanie” w OBS.",
      "requestType": "StartRecord",
      "bodyType": "none",
      "body": ""
    },
    {
      "name": "Zatrzymaj nagrywanie",
      "desc": "Kończy nagrywanie i zamyka plik.",
      "requestType": "StopRecord",
      "bodyType": "none",
      "body": ""
    },
    {
      "name": "Zapisz powtórkę",
      "desc": "Zrzuca na dysk ostatnie sekundy z bufora powtórki. Wymaga włączonego bufora powtórki w OBS.",
      "requestType": "SaveReplayBuffer",
      "bodyType": "none",
      "body": ""
    },
    {
      "name": "Rozpocznij transmisję",
      "desc": "Startuje wysyłkę na platformę ustawioną w OBS (Twitch, YouTube, …).",
      "requestType": "StartStream",
      "bodyType": "none",
      "body": ""
    },
    {
      "name": "Zatrzymaj transmisję",
      "desc": "Kończy wysyłkę na platformę.",
      "requestType": "StopStream",
      "bodyType": "none",
      "body": ""
    },
    {
      "name": "Wycisz mikrofon",
      "desc": "Wycisza źródło dźwięku o nazwie ze zmiennej {{var.OBS_MIKROFON}}.",
      "requestType": "SetInputMute",
      "bodyType": "json",
      "body": "{\n  \"inputName\": \"{{var.OBS_MIKROFON}}\",\n  \"inputMuted\": true\n}"
    },
    {
      "name": "Odcisz mikrofon",
      "desc": "Zdejmuje wyciszenie ze źródła {{var.OBS_MIKROFON}}.",
      "requestType": "SetInputMute",
      "bodyType": "json",
      "body": "{\n  \"inputName\": \"{{var.OBS_MIKROFON}}\",\n  \"inputMuted\": false\n}"
    }
  ],
  "guidePL": "1. W OBS Studio otwórz Narzędzia → Ustawienia serwera WebSocket i zaznacz „Włącz serwer WebSocket”. Domyślny port to 4455.\n2. Jeśli zostawiasz zaznaczone „Włącz uwierzytelnianie” (zalecane), kliknij „Pokaż informacje o połączeniu” i skopiuj hasło.\n3. W RibbitFlip, w karcie „Sejf poświadczeń”, dodaj poświadczenie typu „Hasło OBS (WebSocket)” i wklej w nie to hasło. Samo hasło nigdy nie opuszcza Twojej przeglądarki — do OBS-a jedzie tylko wyliczony z niego podpis.\n4. W karcie „OBS Studio” (u góry tego ekranu) wpisz adres 127.0.0.1 i port 4455, wybierz przed chwilą dodane hasło i kliknij „Połącz”. Pigułka powinna zrobić się zielona i pokazać wersję OBS-a.\n5. W karcie „Zmienne” dodaj OBS_SCENA (dokładna nazwa sceny z OBS, np. „Kamera”) oraz OBS_MIKROFON (dokładna nazwa źródła dźwięku, np. „Mic/Aux”). Nazwy muszą zgadzać się co do znaku — OBS nie zgaduje.\n6. Sprawdź działanie: przy akcji „Przełącz scenę” kliknij „▶ Wyślij”. Scena w OBS powinna zmienić się od razu; wynik zobaczysz w karcie „Dziennik wysyłek”.\n7. Automat: w pod-zakładce „Wyzwalacze” dodaj wyzwalacz (reguła z ekranu Mapowanie albo własny próg ruchu, np. „pochylenie > 30”) i włącz „Wysyłka automatyczna” u góry ekranu.\n8. OBS na innym komputerze w domu? Serwer WebSocket OBS-a nasłuchuje na całej sieci — w karcie „OBS Studio” wpisz jego adres lokalny (np. 192.168.0.12). Adresy publiczne są zablokowane.",
  "caveats": "Wymaga OBS Studio 28 lub nowszego — obs-websocket 5 jest tam wbudowany; starsze wersje potrzebowały osobnej wtyczki, która mówi innym protokołem (4.x), nieobsługiwanym przez RibbitFlipa. Połączenie trzeba otworzyć ręcznie po każdym starcie OBS-a i RibbitFlipa: nic nie łączy się samo, bo ciche łączenie się z programem, którego akurat nie uruchamiałeś, jest decyzją, a nie ułatwieniem. „Zapisz powtórkę” działa dopiero po włączeniu bufora powtórki w OBS (Ustawienia → Wyjście → Bufor powtórki) — inaczej OBS odmówi i zobaczysz to w dzienniku. Nazwy scen i źródeł są rozróżniane co do wielkości liter; literówka w {{var.OBS_SCENA}} kończy się odmową „No source was found”. Jedno połączenie na całą aplikację: wszystkie aplikacje OBS z listy poniżej korzystają z tego samego, ustawionego w karcie „OBS Studio”.",
  "en": {
    "name": "OBS Studio — scenes, recording, microphone",
    "desc": "Capsule motion switches an OBS scene, starts recording or mutes the microphone. Over obs-websocket, not HTTP.",
    "credential": "An “OBS password (WebSocket)” credential. You will find the password in OBS: Tools → WebSocket Server Settings → “Show Connect Info”. Paste it into the RibbitFlip vault, then pick it in the “OBS Studio” card at the top of this screen and press “Połącz”. The password itself never travels to OBS — only a signature computed from it in your browser does. If you turned authentication off in OBS, no credential is needed.",
    "guide": "1. In OBS Studio open Tools → WebSocket Server Settings and tick “Enable WebSocket server”. The default port is 4455.\n2. If you leave “Enable Authentication” ticked (recommended), click “Show Connect Info” and copy the password.\n3. In RibbitFlip, in the “Credential vault” card, add a credential of the “OBS password (WebSocket)” kind and paste that password into it. The password never leaves your browser — only a signature computed from it goes to OBS.\n4. In the “OBS Studio” card (top of this screen) enter the address 127.0.0.1 and port 4455, pick the credential you just added and press “Połącz”. The pill should turn green and show the OBS version.\n5. In the “Variables” card add OBS_SCENA (the exact scene name from OBS, e.g. “Camera”) and OBS_MIKROFON (the exact audio input name, e.g. “Mic/Aux”). The names must match character for character — OBS does not guess.\n6. Try it: press “▶ Send” next to the “Switch scene” action. The scene in OBS should change immediately; the result appears in the “Send log” card.\n7. Automate it: in the “Triggers” sub-tab add a trigger (a rule from the Mapping screen, or your own motion threshold such as “tilt > 30”) and switch “Automatic sending” on at the top of the screen.\n8. OBS on another computer at home? The OBS WebSocket server listens on the whole network — enter its local address (e.g. 192.168.0.12) in the “OBS Studio” card. Public addresses are refused.",
    "caveats": "Requires OBS Studio 28 or newer — obs-websocket 5 is built in there; older versions needed a separate plugin that speaks a different protocol (4.x), which RibbitFlip does not support. The connection has to be opened by hand after every OBS or RibbitFlip start: nothing connects on its own, because quietly connecting to a program you did not launch is a decision, not a convenience. “Save replay” only works once the replay buffer is enabled in OBS (Settings → Output → Replay Buffer) — otherwise OBS refuses and you will see it in the log. Scene and source names are case-sensitive; a typo in {{var.OBS_SCENA}} ends in a “No source was found” refusal. One connection for the whole application: every OBS application in the list below uses the one set up in the “OBS Studio” card.",
    "actions": [
      {
        "name": "Switch scene",
        "desc": "Puts the scene named by {{var.OBS_SCENA}} on air (Program)."
      },
      {
        "name": "Start recording",
        "desc": "Starts recording to a file — the same as the “Start Recording” button in OBS."
      },
      {
        "name": "Stop recording",
        "desc": "Ends the recording and closes the file."
      },
      {
        "name": "Save replay",
        "desc": "Writes the last seconds of the replay buffer to disk. Needs the replay buffer enabled in OBS."
      },
      {
        "name": "Start streaming",
        "desc": "Starts sending to the platform configured in OBS (Twitch, YouTube, …)."
      },
      {
        "name": "Stop streaming",
        "desc": "Ends sending to the platform."
      },
      {
        "name": "Mute microphone",
        "desc": "Mutes the audio input named by {{var.OBS_MIKROFON}}."
      },
      {
        "name": "Unmute microphone",
        "desc": "Removes the mute from the {{var.OBS_MIKROFON}} input."
      }
    ]
  }
}
];
