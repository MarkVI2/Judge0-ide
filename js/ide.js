import configuration from "./configuration.js";

// Comment out Puter import
// import { usePuter } from "./puter.js";

const API_KEY = ""; // Get yours at https://platform.sulu.sh/apis/judge0

const AUTH_HEADERS = API_KEY
  ? {
      Authorization: `Bearer ${API_KEY}`,
    }
  : {};

const CE = "CE";
const EXTRA_CE = "EXTRA_CE";

const AUTHENTICATED_CE_BASE_URL = "https://codeapi.euclid-mu.in";
const AUTHENTICATED_EXTRA_CE_BASE_URL = "";

var AUTHENTICATED_BASE_URL = {};
AUTHENTICATED_BASE_URL[CE] = AUTHENTICATED_CE_BASE_URL;
AUTHENTICATED_BASE_URL[EXTRA_CE] = AUTHENTICATED_EXTRA_CE_BASE_URL;

const UNAUTHENTICATED_CE_BASE_URL = "https://codeapi.euclid-mu.in";
const UNAUTHENTICATED_EXTRA_CE_BASE_URL = "";

var UNAUTHENTICATED_BASE_URL = {};
UNAUTHENTICATED_BASE_URL[CE] = UNAUTHENTICATED_CE_BASE_URL;
UNAUTHENTICATED_BASE_URL[EXTRA_CE] = UNAUTHENTICATED_EXTRA_CE_BASE_URL;

const INITIAL_WAIT_TIME_MS = 0;
const WAIT_TIME_FUNCTION = (i) => 100;
const MAX_PROBE_REQUESTS = 50;

var fontSize = 13;

var layout;

export var sourceEditor;
var stdinEditor;
var stdoutEditor;

var $selectLanguage;
var $compilerOptions;
var $commandLineArguments;
var $runBtn;
var $statusLine;

var timeStart;

var sqliteAdditionalFiles;
var languages = {};

var gPuterFile = null;

var layoutConfig = {
  settings: {
    showPopoutIcon: false,
    reorderEnabled: true,
  },
  content: [
    {
      type: configuration.get("appOptions.mainLayout"),
      content: [
        {
          type: "component",
          width: 66,
          componentName: "source",
          id: "source",
          title: "Source Code",
          isClosable: false,
          componentState: {
            readOnly: false,
          },
        },
        {
          type: configuration.get("appOptions.assistantLayout"),
          title: "AI Assistant and I/O",
          content: [
            configuration.get("appOptions.showAIAssistant")
              ? {
                  type: "component",
                  height: 66,
                  componentName: "ai",
                  id: "ai",
                  title: "AI Assistant",
                  isClosable: false,
                  componentState: {
                    readOnly: false,
                  },
                }
              : null,
            {
              type: configuration.get("appOptions.ioLayout"),
              title: "I/O",
              content: [
                configuration.get("appOptions.showInput")
                  ? {
                      type: "component",
                      componentName: "stdin",
                      id: "stdin",
                      title: "Input",
                      isClosable: false,
                      componentState: {
                        readOnly: false,
                      },
                    }
                  : null,
                configuration.get("appOptions.showOutput")
                  ? {
                      type: "component",
                      componentName: "stdout",
                      id: "stdout",
                      title: "Output",
                      isClosable: true,
                      componentState: {
                        readOnly: true,
                      },
                    }
                  : null,
              ].filter(Boolean),
            },
          ].filter(Boolean),
        },
      ],
    },
  ],
};

function encode(str) {
  return btoa(unescape(encodeURIComponent(str || "")));
}

function decode(bytes) {
  var escaped = escape(atob(bytes || ""));
  try {
    return decodeURIComponent(escaped);
  } catch {
    return unescape(escaped);
  }
}

function showError(title, content) {
  $("#judge0-site-modal #title").html(title);
  $("#judge0-site-modal .content").html(content);

  let reportTitle = encodeURIComponent(`Error on ${window.location.href}`);
  let reportBody = encodeURIComponent(
    `**Error Title**: ${title}\n` +
      `**Error Timestamp**: \`${new Date()}\`\n` +
      `**Origin**: ${window.location.href}\n` +
      `**Description**:\n${content}`
  );

  $("#report-problem-btn").attr(
    "href",
    `https://github.com/judge0/ide/issues/new?title=${reportTitle}&body=${reportBody}`
  );
  $("#judge0-site-modal").modal("show");
}

function showHttpError(jqXHR) {
  showError(
    `${jqXHR.statusText} (${jqXHR.status})`,
    `<pre>${JSON.stringify(jqXHR, null, 4)}</pre>`
  );
}

function handleRunError(jqXHR) {
  showHttpError(jqXHR);
  $runBtn.removeClass("loading");

  window.top.postMessage(
    JSON.parse(
      JSON.stringify({
        event: "runError",
        data: jqXHR,
      })
    ),
    "*"
  );
}
function handleResult(data) {
  const tat = Math.round(performance.now() - timeStart);
  console.log(`It took ${tat}ms to get submission result.`);

  const status = data.status;
  const stdout = decode(data.stdout);
  const compileOutput = decode(data.compile_output);
  const time = data.time === null ? "-" : data.time + "s";
  const memory = data.memory === null ? "-" : data.memory + "KB";

  $statusLine.html(`${status.description}, ${time}, ${memory} (TAT: ${tat}ms)`);

  const output = [compileOutput, stdout]
    .filter((x) => x)
    .join("\n")
    .trimEnd();

  stdoutEditor.setValue(output);

  $runBtn.removeClass("loading");

  window.top.postMessage(
    JSON.parse(
      JSON.stringify({
        event: "postExecution",
        status: data.status,
        time: data.time,
        memory: data.memory,
        output: output,
      })
    ),
    "*"
  );
}

async function getSelectedLanguage() {
  return getLanguage(getSelectedLanguageFlavor(), getSelectedLanguageId());
}

function getSelectedLanguageId() {
  const value = $("#select-language").dropdown("get value");
  // Ensure we have a valid numeric value
  if (!value || isNaN(parseInt(value))) {
    // console.log("Warning: Invalid language ID detected, using default");
    return DEFAULT_LANGUAGE_ID;
  }
  return parseInt(value);
}

function getSelectedLanguageFlavor() {
  const value = $("#select-language").dropdown("get value");
  if (!value) {
    // console.log("Warning: No language selected, using default flavor");
    return CE;
  }

  const option = document.querySelector(
    `#language-select option[value="${value}"]`
  );
  return option ? option.getAttribute("flavor") || CE : CE;
}

function run() {
  if (sourceEditor.getValue().trim() === "") {
    showError("Error", "Source code can't be empty!");
    return;
  } else {
    $runBtn.addClass("loading");
  }

  stdoutEditor.setValue("");
  $statusLine.html("");

  let x = layout.root.getItemsById("stdout")[0];
  x.parent.header.parent.setActiveContentItem(x);

  // Get the current file name and extension to ensure language matches
  const sourceName = getSourceCodeName();
  const fileExtension = sourceName.split('.').pop().toLowerCase();
  
  // Check if we need to adjust language based on file extension
  const currentLangId = getSelectedLanguageId();
  const sourceCodeContent = sourceEditor.getValue();
  
  // If file has an extension and it doesn't match the selected language, adjust it
  if (fileExtension && EXTENSIONS_TABLE[fileExtension]) {
    const expectedLang = EXTENSIONS_TABLE[fileExtension];
    if (expectedLang.language_id !== currentLangId) {
      console.log(`Language mismatch detected! File extension is .${fileExtension} but language ID is ${currentLangId}`);
      console.log(`Auto-selecting language ${expectedLang.language_id} based on file extension`);
      selectLanguageByFlavorAndId(expectedLang.language_id, expectedLang.flavor);
    }
  }
  
  // Get updated language after potential adjustment
  let languageId = getSelectedLanguageId();
  let flavor = getSelectedLanguageFlavor();
  
  // Encode values for submission
  let sourceValue = encode(sourceCodeContent);
  let stdinValue = encode(stdinEditor.getValue());
  let compilerOptions = $compilerOptions.val();
  let commandLineArguments = $commandLineArguments.val();

  // Special case for language ID 44
  if (languageId === 44) {
    sourceValue = sourceCodeContent;
  }

  let data = {
    source_code: sourceValue,
    language_id: languageId,
    stdin: stdinValue,
    compiler_options: compilerOptions,
    command_line_arguments: commandLineArguments,
    redirect_stderr_to_stdout: true,
  };

  // Log debug information
  console.log("Submission details:");
  console.log("- File name:", sourceName);
  console.log("- File extension:", fileExtension);
  console.log("- Selected language ID:", languageId);
  console.log("- Selected language flavor:", flavor);

  let sendRequest = function (data) {
    window.top.postMessage(
      JSON.parse(
        JSON.stringify({
          event: "preExecution",
          source_code: sourceEditor.getValue(),
          language_id: languageId,
          flavor: flavor,
          stdin: stdinEditor.getValue(),
          compiler_options: compilerOptions,
          command_line_arguments: commandLineArguments,
        })
      ),
      "*"
    );

    timeStart = performance.now();
    $.ajax({
      url: `${AUTHENTICATED_BASE_URL[flavor]}/submissions?base64_encoded=true&wait=false`,
      type: "POST",
      contentType: "application/json",
      data: JSON.stringify(data),
      headers: AUTH_HEADERS,
      success: function (data, textStatus, request) {
        console.log(`Your submission token is: ${data.token}`);
        let region = request.getResponseHeader("X-Judge0-Region");
        setTimeout(
          fetchSubmission.bind(null, flavor, region, data.token, 1),
          INITIAL_WAIT_TIME_MS
        );
      },
      error: handleRunError,
    });
  };

  if (languageId === 82) {
    if (!sqliteAdditionalFiles) {
      $.ajax({
        url: `./data/additional_files_zip_base64.txt`,
        contentType: "text/plain",
        success: function (responseData) {
          sqliteAdditionalFiles = responseData;
          data["additional_files"] = sqliteAdditionalFiles;
          sendRequest(data);
        },
        error: handleRunError,
      });
    } else {
      data["additional_files"] = sqliteAdditionalFiles;
      sendRequest(data);
    }
  } else {
    sendRequest(data);
  }
}

function fetchSubmission(flavor, region, submission_token, iteration) {
  if (iteration >= MAX_PROBE_REQUESTS) {
    handleRunError(
      {
        statusText: "Maximum number of probe requests reached.",
        status: 504,
      },
      null,
      null
    );
    return;
  }

  $.ajax({
    url: `${UNAUTHENTICATED_BASE_URL[flavor]}/submissions/${submission_token}?base64_encoded=true`,
    headers: {
      "X-Judge0-Region": region,
    },
    success: function (data) {
      if (data.status.id <= 2) {
        // In Queue or Processing
        $statusLine.html(data.status.description);
        setTimeout(
          fetchSubmission.bind(
            null,
            flavor,
            region,
            submission_token,
            iteration + 1
          ),
          WAIT_TIME_FUNCTION(iteration)
        );
      } else {
        handleResult(data);
      }
    },
    error: handleRunError,
  });
}

function setSourceCodeName(name) {
  $(".lm_title")[0].innerText = name;
}

function getSourceCodeName() {
  return $(".lm_title")[0].innerText;
}

function openFile(content, filename) {
  clear();
  sourceEditor.setValue(content);
  selectLanguageForExtension(filename.split(".").pop());
  setSourceCodeName(filename);
}

function saveFile(content, filename) {
  const blob = new Blob([content], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

async function openAction() {
  // Removed Puter integration, only use standard file input
  document.getElementById("open-file-input").click();
}

async function saveAction() {
  // Removed Puter integration, only use standard file saving
  saveFile(sourceEditor.getValue(), getSourceCodeName());
}

function setFontSizeForAllEditors(fontSize) {
  sourceEditor.updateOptions({ fontSize: fontSize });
  stdinEditor.updateOptions({ fontSize: fontSize });
  stdoutEditor.updateOptions({ fontSize: fontSize });
}

async function loadLangauges() {
  return new Promise((resolve, reject) => {
    let options = [];

    $.ajax({
      url: UNAUTHENTICATED_CE_BASE_URL + "/languages",
      success: function (data) {
        for (let i = 0; i < data.length; i++) {
          let language = data[i];
          let option = new Option(language.name, language.id);
          option.setAttribute("flavor", CE);
          option.setAttribute(
            "language_mode",
            getEditorLanguageMode(language.name)
          );

          if (language.id !== 89) {
            options.push(option);
          }

          if (language.id === DEFAULT_LANGUAGE_ID) {
            option.selected = true;
          }
        }
      },
      error: function (jqXHR, textStatus, errorThrown) {
        console.warn(
          "Error loading languages from primary endpoint:",
          textStatus,
          errorThrown
        );
        // Add default C++ language option
        let option = new Option("C++ (GCC)", DEFAULT_LANGUAGE_ID);
        option.setAttribute("flavor", CE);
        option.setAttribute("language_mode", "cpp");
        option.selected = true;
        options.push(option);
      },
      timeout: 5000, // Set a timeout to avoid hanging
    }).always(function () {
      // Append option elements to the native <select>
      $("#language-select").append(options);
      // Build Semantic UI dropdown menu items from the same options
      const $semMenu = $("#select-language .menu").empty();
      options.forEach((opt) => {
        const $opt = $(opt);
        const val = $opt.val();
        const text = $opt.text();
        $semMenu.append(`
          <div class="item" data-value="${val}">${text}</div>
        `);
      });
      // Build custom dropdown list from loaded options
      const $customList = $("#language-dropdown-list");
      $customList.find("li:not(.hidden)").remove();
      options.forEach((opt) => {
        const $opt = $(opt);
        const val = $opt.val();
        const text = $opt.text();
        const $li = $(
          `<li class="px-4 py-1 mx-2 rounded-md cursor-pointer judge0-dropdown-option hover:bg-zinc-100 dark:hover:bg-zinc-800" data-value="${val}">${text}</li>`
        );
        $customList.append($li);
      });
      // Handle custom dropdown option clicks
      $customList
        .off("click")
        .on("click", ".judge0-dropdown-option", function () {
          const value = $(this).data("value");
          const text = $(this).text();
          $(".judge0-dropdown-value").text(text);
          // Update semantic UI dropdown value
          $("#select-language").dropdown("set selected", value);
          $(this).closest(".judge0-dropdown-menu").addClass("hidden");
        });
      resolve();
      return;
    });
  });
}

async function loadSelectedLanguage(skipSetDefaultSourceCodeName = false) {
  const selectedOption = document.querySelector(
    "#language-select option:checked"
  );
  const languageMode = selectedOption
    ? selectedOption.getAttribute("language_mode")
    : "plaintext";
  monaco.editor.setModelLanguage(sourceEditor.getModel(), languageMode);

  if (!skipSetDefaultSourceCodeName) {
    const lang = await getSelectedLanguage();
    setSourceCodeName(lang.source_file);
  }
}

function selectLanguageByFlavorAndId(languageId, flavor) {
  let option = $selectLanguage.find(`[value=${languageId}][flavor=${flavor}]`);
  if (option.length) {
    option.prop("selected", true);
    $selectLanguage.trigger("change", { skipSetDefaultSourceCodeName: true });
  }
}

function selectLanguageForExtension(extension) {
  let language = getLanguageForExtension(extension);
  selectLanguageByFlavorAndId(language.language_id, language.flavor);
}

async function getLanguage(flavor, languageId) {
  return new Promise((resolve, reject) => {
    // Check if the languageId is valid
    if (!languageId || isNaN(languageId)) {
      console.error(
        `Invalid language ID: ${languageId}, using default language info`
      );

      // Return a default language object to prevent errors
      const defaultLanguage = {
        id: DEFAULT_LANGUAGE_ID,
        name: "C++ (Default)",
        source_file: "main.cpp",
        language_mode: "cpp",
      };

      // Cache this default language
      if (!languages[flavor]) {
        languages[flavor] = {};
      }
      languages[flavor][DEFAULT_LANGUAGE_ID] = defaultLanguage;

      resolve(defaultLanguage);
      return;
    }

    // Check if we already have cached language data
    if (languages[flavor] && languages[flavor][languageId]) {
      resolve(languages[flavor][languageId]);
      return;
    }

    // console.log(`Fetching language details for languageId ${languageId} from ${UNAUTHENTICATED_BASE_URL[flavor]}`);

    $.ajax({
      url: `${UNAUTHENTICATED_BASE_URL[flavor]}/languages/${languageId}`,
      success: function (data) {
        if (!languages[flavor]) {
          languages[flavor] = {};
        }

        // Ensure the data has a source_file property, default to a reasonable file name if missing
        if (!data.source_file) {
          const extension = getDefaultExtensionForLanguage(data.name);
          data.source_file = `main.${extension}`;
        }

        languages[flavor][languageId] = data;
        resolve(data);
      },
      error: function (xhr, status, error) {
        console.error(`Error fetching language ${languageId}: ${error}`);

        // Return a default language object to prevent cascading errors
        const defaultLanguage = {
          id: languageId,
          name: getLanguageNameById(languageId),
          source_file: getDefaultFileNameById(languageId),
        };

        // Cache this default language
        if (!languages[flavor]) {
          languages[flavor] = {};
        }
        languages[flavor][languageId] = defaultLanguage;

        resolve(defaultLanguage);
      },
    });
  });
}

// Helper function to get a default file extension based on language name
function getDefaultExtensionForLanguage(languageName) {
  if (!languageName) return "txt";

  languageName = languageName.toLowerCase();

  if (languageName.includes("c++")) return "cpp";
  if (languageName.includes("python")) return "py";
  if (languageName.includes("java") && !languageName.includes("javascript"))
    return "java";
  if (languageName.includes("javascript") || languageName.includes("node"))
    return "js";
  if (languageName.includes("typescript")) return "ts";
  if (languageName.includes("c#")) return "cs";
  if (languageName.includes("ruby")) return "rb";
  if (languageName.includes("go")) return "go";
  if (languageName.includes("rust")) return "rs";
  if (languageName.includes("php")) return "php";
  if (languageName.includes("swift")) return "swift";
  if (languageName.includes("kotlin")) return "kt";
  if (
    languageName.includes("c") &&
    !languageName.includes("c++") &&
    !languageName.includes("c#")
  )
    return "c";

  return "txt";
}

// Helper function to get language name by ID
function getLanguageNameById(id) {
  const languageMap = {
    54: "C++ (GCC)",
    71: "Python (3.8.1)",
    62: "Java",
    63: "JavaScript",
    49: "C (GCC)",
    43: "Plain Text",
  };

  return languageMap[id] || `Language ${id}`;
}

// Helper function to get default filename by language ID
function getDefaultFileNameById(id) {
  const fileNameMap = {
    54: "main.cpp",
    71: "script.py",
    62: "Main.java",
    63: "script.js",
    49: "main.c",
    43: "file.txt",
  };

  return fileNameMap[id] || "source.txt";
}

function setDefaults() {
  setFontSizeForAllEditors(fontSize);
  sourceEditor.setValue(DEFAULT_SOURCE);
  stdinEditor.setValue(DEFAULT_STDIN);
  $compilerOptions.val(DEFAULT_COMPILER_OPTIONS);
  $commandLineArguments.val(DEFAULT_CMD_ARGUMENTS);

  $statusLine.html("");

  loadSelectedLanguage();
}

function clear() {
  sourceEditor.setValue("");
  stdinEditor.setValue("");
  $compilerOptions.val("");
  $commandLineArguments.val("");

  $statusLine.html("");
}

function refreshSiteContentHeight() {
  // No-op: layout container uses flexbox for sizing
}

function refreshLayoutSize() {
  // Update layout size on window resize
  if (layout) {
    layout.updateSize();
  }
}

window.addEventListener("resize", refreshLayoutSize);
window.addEventListener("load", async function () {
  console.log(
    "Hey, Judge0 IDE is open-sourced: https://github.com/judge0/ide. Have fun!"
  );

  // Initialize the $selectLanguage variable
  $selectLanguage = $("#language-select");
  
  // Load languages, then initialize dropdown and defaults
  const $semanticDropdown = $("#select-language");
  const $languageSelect = $("#language-select");
  $languageSelect.change(function (event, data) {
    const skipName = (data && data.skipSetDefaultSourceCodeName) || false;
    loadSelectedLanguage(skipName);
    const text = $semanticDropdown.dropdown("get text");
    $(".judge0-dropdown-value").text(text || "Select Language");
  });

  await loadLangauges();
  // Initialize Semantic UI dropdowns except the hidden language-select we manage manually
  $(".ui.selection.dropdown").not("#select-language").dropdown();
  // Set default selected value in native <select>
  document.querySelector(
    `#language-select option[value="${DEFAULT_LANGUAGE_ID}"]`
  ).selected = true;
  // Refresh Semantic UI to sync menu
  $("#select-language").dropdown("refresh");

  // Initialize popups and reveal body
  $("[data-content]").popup({ lastResort: "left center" });
  refreshSiteContentHeight();

  $compilerOptions = $("#judge0-compiler-options");
  $commandLineArguments = $("#judge0-command-line-arguments");

  $runBtn = $("#judge0-run-btn");
  $runBtn.click(run);

  $("#open-file-input").change(function (e) {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const reader = new FileReader();
      reader.onload = function (e) {
        openFile(e.target.result, selectedFile.name);
      };

      reader.onerror = function (e) {
        showError("Error", "Error reading file: " + e.target.error);
      };

      reader.readAsText(selectedFile);
    }
  });

  $statusLine = $("#judge0-status-line");

  if (configuration.get("appOptions.showAIAssistant")) {
    monaco.languages.registerInlineCompletionsProvider("*", {
      provideInlineCompletions: async (model, position) => {
        // AI completions code...
      },
      handleItemDidShow: () => {},
      freeInlineCompletions: () => {},
    });
  }

  // Custom language dropdown toggle
  $(document).on(
    "click",
    ".judge0-showSelectLanguage .judge0-dropdown-btn",
    function () {
      const $menu = $(this)
        .closest(".judge0-showSelectLanguage")
        .find(".judge0-dropdown-menu");
      $menu.toggleClass("hidden");

      // Ensure other dropdown menus are closed
      $(".judge0-dropdown-menu").not($menu).addClass("hidden");

      // Update custom dropdown list from the hidden select
      updateCustomDropdownOptions();
    }
  );

  // Close dropdown when clicking outside
  $(document).on("click", function (e) {
    if (!$(e.target).closest(".judge0-dropdown").length) {
      $(".judge0-dropdown-menu").addClass("hidden");
    }
  });

  // Handle custom dropdown option selection
  $(document).on("click", "#language-dropdown-list li", function () {
    const value = $(this).data("value");
    const text = $(this).text();

    // Update custom display
    $(".judge0-dropdown-value").text(text);

    // Update hidden native select and underlying semantic UI dropdown
    $("#language-select").val(value).trigger("change");

    // Update selected state in custom list
    $("#language-dropdown-list li").removeClass("selected");
    $(this).addClass("selected");

    // Hide dropdown menu
    $(this).closest(".judge0-dropdown-menu").addClass("hidden");
  });

  // Function to update custom dropdown options from select
  function updateCustomDropdownOptions() {
    const $list = $("#language-dropdown-list");
    const selectedValue = $("#language-select").val();

    // Only rebuild if empty
    if ($list.children().length <= 1) {
      $list.empty();

      $("#language-select option").each(function () {
        const val = $(this).val();
        const text = $(this).text();
        const isSelected = val == selectedValue;
        const selectedClass = isSelected ? "selected" : "";

        $list.append(
          `<li class="judge0-dropdown-option ${selectedClass}" data-value="${val}">${text}</li>`
        );
      });
    } else {
      // Just update selected state
      $list
        .find("li")
        .removeClass("selected")
        .filter(`[data-value="${selectedValue}"]`)
        .addClass("selected");
    }
  }

  $(document).on("keydown", "body", function (e) {
    if (e.metaKey || e.ctrlKey) {
      switch (e.key) {
        case "Enter":
          e.preventDefault();
          run();
          break;
        case "s":
          e.preventDefault();
          saveAction();
          break;
        case "o":
          e.preventDefault();
          openAction();
          break;
        case "+":
        case "=":
          e.preventDefault();
          fontSize += 1;
          setFontSizeForAllEditors(fontSize);
          break;
        case "-":
          e.preventDefault();
          fontSize -= 1;
          setFontSizeForAllEditors(fontSize);
          break;
        case "0":
          e.preventDefault();
          fontSize = 13;
          setFontSizeForAllEditors(fontSize);
          break;
        case "`":
          e.preventDefault();
          sourceEditor.focus();
          break;
      }
    }
  });

  require(["vs/editor/editor.main"], function (ignorable) {
    layout = new GoldenLayout(
      layoutConfig,
      document.getElementsByTagName("main")[0]
    );

    layout.registerComponent("source", function (container, state) {
      sourceEditor = monaco.editor.create(container.getElement()[0], {
        automaticLayout: true,
        scrollBeyondLastLine: true,
        readOnly: state.readOnly,
        language: "cpp",
        minimap: {
          enabled: true,
        },
      });

      sourceEditor.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
        run
      );
    });

    layout.registerComponent("stdin", function (container, state) {
      stdinEditor = monaco.editor.create(container.getElement()[0], {
        automaticLayout: true,
        scrollBeyondLastLine: false,
        readOnly: state.readOnly,
        language: "plaintext",
        minimap: {
          enabled: false,
        },
      });
    });

    layout.registerComponent("stdout", function (container, state) {
      stdoutEditor = monaco.editor.create(container.getElement()[0], {
        automaticLayout: true,
        scrollBeyondLastLine: false,
        readOnly: state.readOnly,
        language: "plaintext",
        minimap: {
          enabled: false,
        },
      });
    });

    layout.registerComponent("ai", function (container, state) {
      container
        .getElement()[0]
        .appendChild(document.getElementById("judge0-chat-container"));
    });

    layout.init();
    setDefaults();
    refreshLayoutSize();
    window.top.postMessage({ event: "initialised" }, "*");
  });

  let superKey = "⌘";
  if (!/(Mac|iPhone|iPod|iPad)/i.test(navigator.platform)) {
    superKey = "Ctrl";
  }

  [$runBtn].forEach((btn) => {
    btn.attr("data-content", `${superKey}${btn.attr("data-content")}`);
  });

  document.querySelectorAll(".description").forEach((e) => {
    e.innerText = `${superKey}${e.innerText}`;
  });

  document
    .getElementById("judge0-open-file-btn")
    .addEventListener("click", openAction);
  document
    .getElementById("judge0-save-btn")
    .addEventListener("click", saveAction);

  window.onmessage = function (e) {
    if (!e.data) {
      return;
    }

    if (e.data.action === "get") {
      window.top.postMessage(
        JSON.parse(
          JSON.stringify({
            event: "getResponse",
            source_code: sourceEditor.getValue(),
            language_id: getSelectedLanguageId(),
            flavor: getSelectedLanguageFlavor(),
            stdin: stdinEditor.getValue(),
            stdout: stdoutEditor.getValue(),
            compiler_options: $compilerOptions.val(),
            command_line_arguments: $commandLineArguments.val(),
          })
        ),
        "*"
      );
    } else if (e.data.action === "set") {
      if (e.data.source_code) {
        sourceEditor.setValue(e.data.source_code);
      }
      if (e.data.language_id && e.data.flavor) {
        selectLanguageByFlavorAndId(e.data.language_id, e.data.flavor);
      }
      if (e.data.stdin) {
        stdinEditor.setValue(e.data.stdin);
      }
      if (e.data.stdout) {
        stdoutEditor.setValue(e.data.stdout);
      }
      if (e.data.compiler_options) {
        $compilerOptions.val(e.data.compiler_options);
      }
      if (e.data.command_line_arguments) {
        $commandLineArguments.val(e.data.command_line_arguments);
      }
      if (e.data.api_key) {
        AUTH_HEADERS["Authorization"] = `Bearer ${e.data.api_key}`;
      }
    } else if (e.data.action === "run") {
      run();
    }
  };
});

const DEFAULT_SOURCE =
  "\
#include <algorithm>\n\
#include <cstdint>\n\
#include <iostream>\n\
#include <limits>\n\
#include <set>\n\
#include <utility>\n\
#include <vector>\n\
\n\
using Vertex    = std::uint16_t;\n\
using Cost      = std::uint16_t;\n\
using Edge      = std::pair< Vertex, Cost >;\n\
using Graph     = std::vector< std::vector< Edge > >;\n\
using CostTable = std::vector< std::uint64_t >;\n\
\n\
constexpr auto kInfiniteCost{ std::numeric_limits< CostTable::value_type >::max() };\n\
\n\
auto dijkstra( Vertex const start, Vertex const end, Graph const & graph, CostTable & costTable )\n\
{\n\
    std::fill( costTable.begin(), costTable.end(), kInfiniteCost );\n\
    costTable[ start ] = 0;\n\
\n\
    std::set< std::pair< CostTable::value_type, Vertex > > minHeap;\n\
    minHeap.emplace( 0, start );\n\
\n\
    while ( !minHeap.empty() )\n\
    {\n\
        auto const vertexCost{ minHeap.begin()->first  };\n\
        auto const vertex    { minHeap.begin()->second };\n\
\n\
        minHeap.erase( minHeap.begin() );\n\
\n\
        if ( vertex == end )\n\
        {\n\
            break;\n\
        }\n\
\n\
        for ( auto const & neighbourEdge : graph[ vertex ] )\n\
        {\n\
            auto const & neighbour{ neighbourEdge.first };\n\
            auto const & cost{ neighbourEdge.second };\n\
\n\
            if ( costTable[ neighbour ] > vertexCost + cost )\n\
            {\n\
                minHeap.erase( { costTable[ neighbour ], neighbour } );\n\
                costTable[ neighbour ] = vertexCost + cost;\n\
                minHeap.emplace( costTable[ neighbour ], neighbour );\n\
            }\n\
        }\n\
    }\n\
\n\
    return costTable[ end ];\n\
}\n\
\n\
int main()\n\
{\n\
    constexpr std::uint16_t maxVertices{ 10000 };\n\
\n\
    Graph     graph    ( maxVertices );\n\
    CostTable costTable( maxVertices );\n\
\n\
    std::uint16_t testCases;\n\
    std::cin >> testCases;\n\
\n\
    while ( testCases-- > 0 )\n\
    {\n\
        for ( auto i{ 0 }; i < maxVertices; ++i )\n\
        {\n\
            graph[ i ].clear();\n\
        }\n\
\n\
        std::uint16_t numberOfVertices;\n\
        std::uint16_t numberOfEdges;\n\
\n\
        std::cin >> numberOfVertices >> numberOfEdges;\n\
\n\
        for ( auto i{ 0 }; i < numberOfEdges; ++i )\n\
        {\n\
            Vertex from;\n\
            Vertex to;\n\
            Cost   cost;\n\
\n\
            std::cin >> from >> to >> cost;\n\
            graph[ from ].emplace_back( to, cost );\n\
        }\n\
\n\
        Vertex start;\n\
        Vertex end;\n\
\n\
        std::cin >> start >> end;\n\
\n\
        auto const result{ dijkstra( start, end, graph, costTable ) };\n\
\n\
        if ( result == kInfiniteCost )\n\
        {\n\
            std::cout << \"NO\\n\";\n\
        }\n\
        else\n\
        {\n\
            std::cout << result << '\\n';\n\
        }\n\
    }\n\
\n\
    return 0;\n\
}\n\
";

const DEFAULT_STDIN =
  "\
3\n\
3 2\n\
1 2 5\n\
2 3 7\n\
1 3\n\
3 3\n\
1 2 4\n\
1 3 7\n\
2 3 1\n\
1 3\n\
3 1\n\
1 2 4\n\
1 3\n\
";

const DEFAULT_COMPILER_OPTIONS = "";
const DEFAULT_CMD_ARGUMENTS = "";
const DEFAULT_LANGUAGE_ID = 54; // C++ (GCC 14.1.0) (https://ce.judge0.com/languages/105)

function getEditorLanguageMode(languageName) {
  const DEFAULT_EDITOR_LANGUAGE_MODE = "plaintext";
  const LANGUAGE_NAME_TO_LANGUAGE_EDITOR_MODE = {
    Bash: "shell",
    C: "c",
    C3: "c",
    "C#": "csharp",
    "C++": "cpp",
    Clojure: "clojure",
    "F#": "fsharp",
    Go: "go",
    Java: "java",
    JavaScript: "javascript",
    Kotlin: "kotlin",
    "Objective-C": "objective-c",
    Pascal: "pascal",
    Perl: "perl",
    PHP: "php",
    Python: "python",
    R: "r",
    Ruby: "ruby",
    SQL: "sql",
    Swift: "swift",
    TypeScript: "typescript",
    "Visual Basic": "vb",
  };

  for (let key in LANGUAGE_NAME_TO_LANGUAGE_EDITOR_MODE) {
    if (languageName.toLowerCase().startsWith(key.toLowerCase())) {
      return LANGUAGE_NAME_TO_LANGUAGE_EDITOR_MODE[key];
    }
  }
  return DEFAULT_EDITOR_LANGUAGE_MODE;
}

const EXTENSIONS_TABLE = {
  asm: { flavor: CE, language_id: 45 }, // Assembly (NASM 2.14.02)
  c: { flavor: CE, language_id: 49 }, // C (GCC 8.3.0)
  cpp: { flavor: CE, language_id: 54 }, // C++ (GCC 9.2.0)
  java: { flavor: CE, language_id: 62 }, // Java (OpenJDK 13.0.1)
  js: { flavor: CE, language_id: 63 }, // JavaScript (Node.js 12.14.0)
  lua: { flavor: CE, language_id: 64 }, // Lua (5.3.5)
  pas: { flavor: CE, language_id: 67 }, // Pascal (FPC 3.0.4)
  php: { flavor: CE, language_id: 68 }, // PHP (7.4.1)
  py: { flavor: CE, language_id: 71 }, // Python (3.8.1)
  r: { flavor: CE, language_id: 80 }, // R (4.0.0)
  rb: { flavor: CE, language_id: 72 }, // Ruby (2.7.0)
  rs: { flavor: CE, language_id: 73 }, // Rust (1.40.0)
  scala: { flavor: CE, language_id: 81 }, // Scala (2.13.2)
  sh: { flavor: CE, language_id: 46 }, // Bash (5.0.0)
  swift: { flavor: CE, language_id: 83 }, // Swift (5.2.3)
  ts: { flavor: CE, language_id: 74 }, // TypeScript (3.7.4)
  txt: { flavor: CE, language_id: 43 }, // Plain Text
};

function getLanguageForExtension(extension) {
  return EXTENSIONS_TABLE[extension] || { flavor: CE, language_id: 43 }; // Plain Text (https://ce.judge0.com/languages/43)
}
