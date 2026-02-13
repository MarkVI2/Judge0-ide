"use strict";
import configuration from "./configuration.js";

const ide = {
  LAYOUT_CONFIG: {
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
  },
  layout: null,
  sourceEditor: null,
  stdinEditor: null,
  stdoutEditor: null,
  onMonacoReady: function (callback) {
    require(["vs/editor/editor.main"], callback);
  },
};

export default ide;
