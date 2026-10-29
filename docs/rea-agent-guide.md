# Using REA (Reverse Engineer Anything) as an AI Agent

**Repository:** https://github.com/morluto/rea  
**Package:** `rea-agents` (installed globally as `rea` v6.7.0; 153 CLI commands, 207 MCP tools, 6 MCP prompts)

REA (**Reverse Engineer Anything**) provides AI agents with an evidence-backed MCP server and CLI for inspecting, tracing, comparing, and reconstructing software from observable behavior, packages, captures, and live runtimes.

---

## What "Reverse Engineering" Means for Steady (`financial-coach`)

For this project, **reverse engineering means learning how a system behaves from what we can observe, then recreating the useful parts in our own design.** It does **not** mean cracking applications, bypassing access controls, or copying proprietary code.

In Steady, we apply this evidence-based approach across three concrete areas:

1. **Finance App Experience (UX & Interaction Patterns):**
   - Observing where users enter money details, how spending categories and goals are surfaced, and how mobile navigation is structured across reference apps (M-PESA, Monzo, PesaSense, and YNAB).
   - Documented in [docs/ui-research.md](./ui-research.md): Steady adapts these observable hierarchy patterns into its own KES-localized interface (headline balances → sorted spending map → sequential specialist coaching plan → floating money coach drawer) without implying bank/M-PESA connectivity or unentered budget limits.
2. **Agent Architecture (Source & Schema Inspection):**
   - Studying how the open-source starter project ([upstream/ai_financial_coach_agent.py](../upstream/ai_financial_coach_agent.py)) decomposes coaching into `BudgetAnalysisAgent` → `SavingsStrategyAgent` → `DebtReductionAgent`, what each specialist receives via session state (`{budget_analysis}`, `{savings_strategy}`), and how structured Pydantic schemas (`BudgetAnalysis`, `SavingsStrategy`, `DebtReduction`) validate outputs.
   - Documented in [docs/architecture.md](./architecture.md) and implemented in [backend/agents.py](../backend/agents.py).
3. **Runtime Behavior (Streamed Progress, Contextual Chat & Error Boundaries):**
   - Observing how specialist progress appears while the `SequentialAgent` runs (`before_agent_callback` emitting `status: "working"` and final responses emitting `status: "done"` with elapsed seconds over SSE in [`analyze_stream`](../backend/main.py#L94-L216)).
   - Observing how the conversational coach ([`create_chat_agent`](../backend/agents.py#L179-L194) and [`chat`](../backend/main.py#L218-L281)) consumes the user's current KES profile, recent turns, and latest coaching plan while replying in clean plain text without Markdown clutter.
   - Verifying explicit failure handling (502/504/SSE error events) so failed live runs never degrade into unlabeled demo output.

### Observing a Live Vertex AI Run (Local ADC vs. Protected Vercel Preview)

When Vercel Preview team authorization is still pending, you can observe and verify the exact live Vertex AI specialist stream and contextual chat locally against `operating-ethos-513011-c0`:

1. **Observed Without Active ADC Token (Verified Error Boundary):**
   - [`analyze_stream`](../backend/main.py#L94-L216) attaches `before_agent_callback` to `BudgetAnalysisAgent`, `SavingsStrategyAgent`, and `DebtReductionAgent` and immediately emits:
     ```json
     {"type": "progress", "agent": "BudgetAnalysisAgent", "status": "working"}
     ```
   - When local Google Cloud ADC credentials have expired (`google.auth.exceptions.RefreshError`), [`analyze_stream`](../backend/main.py#L184-L185) catches the failure, deletes the ephemeral ADK session in the `finally` block, and yields an explicit SSE error frame instead of fabricated numbers:
     ```json
     {"type": "error", "detail": "Agent analysis failed. Check model access and cloud configuration."}
     ```
2. **Completing the Live Run with Synthetic KES Figures:**
   - Re-authenticate local ADC (`gcloud auth application-default login` with quota project `operating-ethos-513011-c0`) and start `backend` with `COACH_MODE=live`, `GOOGLE_GENAI_USE_VERTEXAI=TRUE`, `GOOGLE_CLOUD_PROJECT=operating-ethos-513011-c0`, `GOOGLE_CLOUD_LOCATION=global`, and `GEMINI_MODEL=gemini-3.8-flash`.
   - Confirm the six sequential SSE progress transitions (`working` → `done` with `elapsed_seconds` for `BudgetAnalysisAgent` → `SavingsStrategyAgent` → `DebtReductionAgent`), the validated Pydantic payload in the final `result` event, and the plain-text KES reply from `/chat` using `analysis_context`.
   - Once the local Next.js app (`http://127.0.0.1:3001`) or protected Vercel Preview is open in Chrome with remote debugging enabled, use REA's `list_browser_targets` + `observe_web_session` (passive) or `capture_browser_scenario` (automated) to capture an Evidence-backed snapshot of the live UI transitions.

---

## 1. When to Use REA Tools (and When to Use Normal Repo Tools)

- **Use REA** when a claim or task depends on:
  - A shipped binary, executable, library, or firmware image (`PE`, `ELF`, `Mach-O`, `DOS`, raw binary, `WASM`, `EVM` bytecode)
  - A packaged application bundle or archive (`ASAR`, `ZIP`, `APK`, `IPA`, `MSIX`, `AppX`, `DMG`)
  - Bundled or minified JavaScript/Electron apps where original source is absent or differs from the bundle
  - Offline data or network/crash snapshots (`SQLite`, `HAR`, `SAZ`, `PCAP`, `qlog`, Linux ELF core dumps, logic/signal recordings)
  - Passive or scenario-based runtime observation of an open browser page or Electron app over loopback CDP
- **Skip REA** for ordinary analysis of a complete source repository. When full source code is already in the workspace, use normal file search and code reading tools instead of running REA readiness or provider commands.

---

## 2. Core Epistemology: Observations, Inferences, and Unknowns

Every agent conclusion produced with REA must separate facts into three explicit categories:

1. **Observed (`confidence: "observed"` / `"derived"`):** Directly verified facts from artifact bytes, ASTs, headers, disassembler databases, or recorded captures. Always cite the returned `evidence_id` (e.g., `ev_<64-hex>`) and preserve artifact SHA-256 digests, file byte ranges, and addresses.
2. **Inferred (`confidence: "inferred"`):** Decompiler pseudocode, static IPC channel pairings, heuristics, or candidate function selectors. Never present recovered pseudocode as original source code, and never imply that static analysis observed runtime execution.
3. **Unknown:** Unresolved dynamic calls, unanalyzed files outside `source_paths`, missing debug sections, or unavailable providers.
   - Track unresolved questions in the session ledger with `record_unknown` (providing supporting/contradicting Evidence IDs) and update them with `update_unknown` + `verify_unknown_resolution`.
   - Absence of metadata (such as a missing `.dep-v0` Rust section or empty string search) is an explicit unknown or bounded search result, not proof of global absence.

---

## 3. Route the Target First

Select the initial REA tool directly from the artifact or runtime target supplied by the user.

- **Session-bound tools** operate on an active target opened with `open_binary` and must be cleaned up with `close_binary` when finished.
- **Target-free tools** accept their own explicit local `path` or loopback endpoint and do **not** require `open_binary`.

| Target Type | First MCP Tool | CLI Equivalent | Needs `open_binary`? |
| :--- | :--- | :--- | :--- |
| **JavaScript / Electron tree or `.asar`** | `analyze_javascript_application` | `rea analyze-javascript-application <path> --json` | No |
| **Minified / bundled JS recovery (Linux x64 + Wakaru)** | `recover_javascript_sources` | `rea recover-javascript-sources <path> --json` | No |
| **Archive / bundle inventory (`ZIP`, `APK`, `IPA`, `MSIX`, `DMG`)** | `open_binary` → `inspect_artifact` | `rea inspect-artifact <path> --json` | Yes |
| **Materialize files from open archive** | `extract_artifact` | `rea extract-artifact <path> --json` | Yes |
| **Android APK classes, methods, manifest, refs (JADX)** | `inspect_android_package` | `rea inspect-android-package <path> --json` | No |
| **Managed `.NET` PE/CLI assembly** | `inspect_managed_artifact` | `rea inspect-managed-artifact <path> --json` | No |
| **Native executable / library (`PE`, `ELF`, `Mach-O`)** | `open_binary` → `binary_overview` / `analyze_function` | `rea inspect <path>` / `rea function <path> <fn>` | Yes |
| **Offline Linux `ELF` sections, symbols, mitigations** | `inspect_binary_layout` | `rea inspect-binary-layout <path> --json` | No |
| **Portable Windows `PE` resource tree & icons** | `inspect_pe_resources` | `rea inspect-pe-resources <path> --json` | No |
| **Embedded Go build & module metadata** | `inspect_go_binary` | `rea inspect-go-binary <path> --json` | No |
| **Embedded Rust `cargo-auditable` crate metadata** | `inspect_rust_binary` | `rea inspect-rust-binary <path> --json` | No |
| **Local `WASM` binary (with WABT)** | `inspect_wasm_artifact` | `rea inspect-wasm-artifact <path> --json` | No |
| **Local `EVM` bytecode carrier** | `inspect_evm_interface` | `rea inspect-evm-interface <path> --json` | No |
| **Local `SQLite` database snapshot** | `inspect_sqlite_database` | `rea inspect-sqlite-database <path> --json` | No |
| **Web network capture (`HAR`, Fiddler `.saz`, `mitmproxy`, `qlog`)** | `inspect_web_network_capture` | `rea inspect-web-network-capture <path> --json` | No |
| **Packet capture summary / fields (`PCAP` / `PCAPNG`)** | `inspect_pcap_capture` / `inspect_packet_capture` | `rea inspect-pcap-capture <path> --json` | No |
| **Recorded Linux `x86_64` ELF core dump** | `inspect_recorded_crash` | `rea inspect-recorded-crash <path> --json` | No |
| **Firmware image regions / extraction (Linux Binwalk/Unblob)** | `inspect_firmware_regions` / `extract_firmware` | `rea inspect-firmware-regions <path> --json` | No |
| **Open browser page (passive CDP observation)** | `list_browser_targets` → `inspect_web_page` | `rea list-browser-targets` | No |
| **Browser scenario (agent clicks/types/navigates)** | `capture_browser_scenario` | `rea capture-browser-scenario` | No |
| **Open Electron app (passive or scenario)** | `inspect_electron_fuses` / `list_electron_targets` | `rea inspect-electron-fuses <path>` | No |

> **Target Selection Rule:** If the user says only "my app" without a name or path, ask which app they mean before searching for artifacts. Never pick a random test fixture or example app on the user's behalf.

---

## 4. Work Summary-First and Page Retained Evidence

Large binaries, Mach-O frameworks, JavaScript bundles, and network captures can easily exceed MCP transport framing or context budgets. Always follow the **summary-first pattern**:

### Step 1: Request a Summary First
When calling producers that support `detail` (such as `analyze_javascript_application`, `inspect_binary_layout`, `inspect_artifact`, `inspect_wasm_artifact`, `inspect_macho`, `inspect_evm_interface`, `inspect_managed_artifact`, `inspect_Managed_members`, `inspect_android_package`, `inspect_web_network_capture`, or `inspect_pcap_capture`), pass:
```json
{
  "detail": "summary"
}
```
REA stores the complete analysis in its session ledger and returns a lightweight summary containing `normalized_result.parent_evidence_id` (e.g., `ev_...`).

### Step 2: Project Views with `inspect_analysis_view`
Use `inspect_analysis_view` with the retained `parent_evidence_id` to page through collections or inspect specific items without re-running analysis:

- **Page JavaScript modules:**
  ```json
  {
    "source": { "kind": "retained-evidence", "evidence_id": "ev_<PARENT_ID>" },
    "view": { "kind": "page", "collection": "modules", "offset": 0, "limit": 16 }
  }
  ```
- **Inspect one JavaScript module by exact `node_id`:**
  ```json
  {
    "source": { "kind": "retained-evidence", "evidence_id": "ev_<PARENT_ID>" },
    "view": { "kind": "item", "collection": "modules", "selector": { "node_id": "jag_node_<NODE_ID>" } }
  }
  ```
- **Page native function analysis facets (`procedure`, `pseudocode`, `assembly`, `callers`, `callees`, `value_flow_operations`, etc.):**
  ```json
  {
    "source": { "kind": "retained-evidence", "evidence_id": "ev_<FUNCTION_EVIDENCE_ID>" },
    "view": { "kind": "native", "facet": "pseudocode", "offset": 0, "limit": 2000 }
  }
  ```
- **Group HAR requests into an API surface:**
  ```json
  {
    "source": { "kind": "retained-evidence", "evidence_id": "ev_<HAR_EVIDENCE_ID>" },
    "view": { "kind": "api-surface", "include_query_parameter_names": true, "offset": 0, "limit": 50 }
  }
  ```

### Step 3: Trace Focused Seeds Only When Needed
For JavaScript/Electron applications, once you know a specific literal route, IPC channel, string, export, or `node_id`, call `trace_application_feature` with `direction: "incoming"`, `"outgoing"`, or `"both"` using the retained `parent_evidence_id`.

### Step 4: Recovering from Transport Truncation
- If MCP reports `resource_constraint` (`details.resource: "transport"`), do **not** repeat the analysis call. Read `details.reported_limits.evidence_reference` and pass it to `inspect_analysis_view` or `export_evidence_bundle`.
- If the parent ID is unknown, call `get_evidence_bundle` with `detail: "summary"` and exact filters (`operation`, target `sha256`, or procedure address) to look up the retained `evidence_id`.

---

## 5. Staged Workflow for Complex / Multi-Agent Investigations

When reverse engineering a multi-feature application or coordinating across subagents:

1. **Checklist & Evidence Plan:** Break the user's question into concrete hypotheses and identify the exact evidence type required for each (static inventory, AST/module graph, native decompilation, or runtime capture).
2. **Reuse Session State:** Call `binary_session` with `{}` to check if a target is already open, which deep provider (`ghidra`, `ida`, `hopper`) is bound, and which tools are available in `result.tool_availability`.
3. **Start Narrow:** Inspect manifests, entrypoints, and inventories before decompiling individual procedures or tracing deep call graphs.
4. **Delegate Independent Scopes to Subagents:**
   - Export or share retained Evidence IDs / exported Evidence bundles (`export_evidence_bundle`).
   - Assign each subagent a distinct subsystem or binary slice, requiring them to return:
     - **Verified findings** with `evidence_id` and byte/address locations
     - **Inferences** with explicit assumptions
     - **Remaining unknowns** and search boundaries
5. **Compare & Verify:**
   - Use `compare_application_versions` or `compare_javascript_export_shapes` for JS version diffs.
   - Use `compare_artifacts`, `compare_functions`, `build_call_path`, and `correlate_static_and_runtime` for native/package evidence.
   - Use `verify_reconstruction` or `evaluate_reconstruction_coverage` when validating a reconstructed implementation against original evidence.
6. **Clean Up:** Always call `close_binary` when a native or archive session investigation is complete.

---

## 6. CLI Usage and Diagnostics

Because `rea-agents` is installed globally as `rea`, agents and developers can invoke it directly from any terminal or fall back to the CLI if an MCP response is too large to frame inline.

### Useful Global CLI Commands
```powershell
# Check installed version and full command list
rea --version
rea --help

# Inspect MCP registration and provider readiness for Antigravity (or codex, claude_code, cursor, vscode, etc.)
rea doctor --client antigravity --json

# Preview or apply client MCP + skill configuration updates
rea setup --client antigravity --dry-run --json
rea setup --client antigravity --yes

# Analyze a JavaScript/Electron directory or .asar directly via CLI and save Evidence JSON
rea analyze-javascript-application C:\absolute\path\to\app --json > app-evidence.json

# Inspect portable PE resources, Go metadata, or Rust metadata without opening a session
rea inspect-pe-resources C:\absolute\path\to\binary.exe --json
rea inspect-go-binary C:\absolute\path\to\binary.exe --json
rea inspect-rust-binary C:\absolute\path\to\binary.exe --json
```

### Provider Environment Variables (Optional Bring-Your-Own Engines)
Static JavaScript, archive inventories, PE resources, Go/Rust metadata, SQLite snapshots, and HAR/SAZ captures work out of the box with **zero external engines**. Deep native or specialized providers use existing local installations configured via environment variables:
- **Ghidra (12.1.x):** `GHIDRA_INSTALL_DIR` and `JAVA_HOME` (JDK 21+)
- **IDA Pro MCP:** `REA_IDA_MCP_CONFIG` pointing to an upstream IDA MCP JSON config
- **Android APK (JADX):** `REA_JADX_MCP_JAR` (headless JADX MCP JAR 0.7.1) and `JAVA_HOME` (JDK 17+)
- **WASM (WABT 1.0.42):** `REA_WABT_BIN_DIRECTORY`
- **Packet Captures (Wireshark/TShark):** `REA_TSHARK_COMMAND`

