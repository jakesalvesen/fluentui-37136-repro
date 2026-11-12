import { StrictMode, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Button,
  FluentProvider,
  Text,
  makeStyles,
  tokens,
  webLightTheme,
} from "@fluentui/react-components";
import { Toaster, useToastController } from "@fluentui/react-toast";

const TOASTER_ID = "repro";

const useStyles = makeStyles({
  page: {
    fontFamily: tokens.fontFamilyBase,
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    maxWidth: "760px",
  },
  log: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    whiteSpace: "pre-wrap",
    background: tokens.colorNeutralBackground3,
    padding: "12px",
    borderRadius: tokens.borderRadiusMedium,
    minHeight: "140px",
  },
  verdict: {
    padding: "12px",
    borderRadius: tokens.borderRadiusMedium,
    fontWeight: tokens.fontWeightSemibold,
  },
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The Toaster renders one [data-toaster-position] region per active position and
// puts the visible toasts inside it. It does not put role=alert/status on them,
// so selecting by role finds nothing.
function visibleToastText() {
  return [...document.querySelectorAll("[data-toaster-position]")]
    .map((node) => (node.textContent ?? "").trim())
    .join(" | ");
}

async function waitForLabel(label, timeout = 6000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (visibleToastText().includes(label)) return true;
    await sleep(50);
  }
  return false;
}

function App() {
  const styles = useStyles();
  const { dispatchToast, dismissToast } = useToastController(TOASTER_ID);
  const [lines, setLines] = useState([]);
  const [verdict, setVerdict] = useState(null);
  const started = useRef(false);

  const log = useCallback((line) => setLines((prev) => [...prev, line]), []);

  const run = useCallback(async () => {
    setLines([]);
    setVerdict(null);

    // Long timeouts keep every toast alive for the whole sequence, so the
    // default auto-dismiss timeout cannot promote a queued toast behind our back.
    const LONG = 120000;

    try {
      log("1. Toaster is mounted with limit={1}, so exactly one toast is visible at a time.");
      dispatchToast("Toast A (default priority)", { toastId: "A", timeout: LONG });
      const aVisible = await waitForLabel("Toast A");
      log(`   Toast A visible: ${aVisible}`);
      log(`   visible now: ${JSON.stringify(visibleToastText())}`);

      log("");
      log("2. Queue Toast B with priority 1.");
      log("3. Queue Toast C with priority 10.");
      dispatchToast("Toast B (priority 1)", { toastId: "B", priority: 1, timeout: LONG });
      dispatchToast("Toast C (priority 10)", { toastId: "C", priority: 10, timeout: LONG });
      await sleep(500);
      const queuedOnly = !visibleToastText().includes("Toast B") && !visibleToastText().includes("Toast C");
      log(`   visible now: ${JSON.stringify(visibleToastText())} (B and C queued: ${queuedOnly})`);

      log("");
      log("4. Dismiss Toast A, then observe which queued toast is promoted.");
      dismissToast("A");

      const deadline = Date.now() + 6000;
      while (Date.now() < deadline) {
        const text = visibleToastText();
        if (text.includes("Toast B") || text.includes("Toast C")) break;
        await sleep(50);
      }

      const after = visibleToastText();
      const cWon = after.includes("Toast C");
      const bWon = after.includes("Toast B");
      log(`   visible now: ${JSON.stringify(after)}`);

      log("");
      if (cWon) {
        log("RESULT: priority 10 was promoted before priority 1.");
        log("        This matches the documented ordering, so the issue does not reproduce.");
        setVerdict({ ok: true, text: "Documented ordering held: priority 10 was promoted first." });
      } else if (bWon) {
        log("RESULT: priority 1 was promoted before priority 10.");
        log("        The docs say 'Higher priority toasts will be rendered before lower priority");
        log("        toasts', so the queue is promoting the lower value first.");
        setVerdict({
          ok: false,
          text: "Reproduced: priority 1 was promoted before priority 10, the opposite of the documented ordering.",
        });
      } else {
        log("RESULT: neither queued toast became visible.");
        setVerdict({ ok: false, text: "Inconclusive: no queued toast was promoted." });
      }
    } catch (error) {
      log(`ERROR: ${error && error.message ? error.message : String(error)}`);
      log("RESULT: the scenario could not complete.");
      setVerdict({ ok: false, text: "The scenario threw before reaching a verdict." });
    }
  }, [dispatchToast, dismissToast, log]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const timer = setTimeout(() => {
      run();
    }, 300);
    // Deliberately no cleanup: StrictMode's remount would clear the timer and
    // the guard above would then suppress the second schedule.
    void timer;
  }, [run]);

  return (
    <div className={styles.page}>
      <Text as="h1" size={600} weight="semibold">
        microsoft/fluentui#37136 reproduction
      </Text>
      <Text>
        {"@fluentui/react-toast 9.8.5, @fluentui/react-components 9.74.10. A "}
        <code>Toaster</code>
        {" with "}
        <code>limit=1</code>
        {" queues two toasts at priority 1 and priority 10, then dismisses the visible one."}
      </Text>

      <Button appearance="primary" onClick={run} style={{ alignSelf: "flex-start" }}>
        Run again
      </Button>

      {verdict ? (
        <div
          className={styles.verdict}
          style={{
            background: verdict.ok ? tokens.colorPaletteGreenBackground2 : tokens.colorPaletteRedBackground2,
          }}
        >
          {verdict.text}
        </div>
      ) : null}

      <div className={styles.log}>{lines.join("\n")}</div>

      <Toaster toasterId={TOASTER_ID} limit={1} position="top-end" />
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <FluentProvider theme={webLightTheme}>
      <App />
    </FluentProvider>
  </StrictMode>,
);
