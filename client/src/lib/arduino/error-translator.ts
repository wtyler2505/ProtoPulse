// ---------------------------------------------------------------------------
// Arduino Compile Error Translator
// ---------------------------------------------------------------------------
// Translates cryptic gcc/avr-gcc compiler errors into plain English with
// actionable suggestions. Designed for makers and learners who may not have
// a formal C/C++ background.
//
// Builds on top of cli-error-parser.ts (which handles raw parsing) — this
// module adds the "human translation" layer.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ErrorTranslation {
  /** The original raw error line from the compiler. */
  original: string;
  /** Plain English explanation of what went wrong. */
  translated: string;
  /** Actionable suggestion on how to fix it. */
  suggestion: string;
  /** Severity of the diagnostic. */
  severity: 'error' | 'warning' | 'note';
  /** 1-based line number in the source file, if available. */
  lineNumber?: number;
  /** Source file path, if available. */
  file?: string;
}

// ---------------------------------------------------------------------------
// Translation rule database — 35+ patterns
// ---------------------------------------------------------------------------

interface TranslationRule {
  /** Regex pattern to match against the error message (after severity/location). */
  pattern: RegExp;
  /**
   * Build a plain English translation from the regex match.
   * Receives the full match array so named captures can extract specifics.
   */
  translate: (match: RegExpMatchArray, fullLine: string) => string;
  /** Actionable fix suggestion. */
  suggestion: (match: RegExpMatchArray) => string;
}

const TRANSLATION_RULES: TranslationRule[] = [
  // --- Scope / declaration errors ---
  {
    pattern: /[''""](.+?)[''""] was not declared in this scope/i,
    translate: (m) =>
      `The name '${m[1]}' doesn't exist here. The compiler can't find a variable, function, or type called '${m[1]}'.`,
    suggestion: () =>
      'Check the spelling. Make sure you defined it before using it, or add the right #include for the library that provides it.',
  },
  {
    pattern: /[''""](.+?)[''""] does not name a type/i,
    translate: (m) =>
      `'${m[1]}' is not recognized as a type. The compiler doesn't know what '${m[1]}' is.`,
    suggestion: () =>
      'Add #include for the library that defines this type, or check for a typo in the type name.',
  },
  {
    pattern: /use of undeclared identifier [''""](.+?)[''""]?/i,
    translate: (m) =>
      `The name '${m[1]}' hasn't been declared. The compiler has no idea what '${m[1]}' refers to.`,
    suggestion: () =>
      'Define the variable or function before using it, or add the necessary #include.',
  },

  // --- Semicolons and syntax ---
  {
    pattern: /expected [''""];[''""] before/i,
    translate: () =>
      'Missing semicolon. A statement on the previous line (or this line) is not properly terminated.',
    suggestion: () =>
      'Add a semicolon (;) at the end of the previous line.',
  },
  {
    pattern: /expected [''""];[''""]\s*$/i,
    translate: () =>
      'Missing semicolon at the end of a statement.',
    suggestion: () =>
      'Add a ; at the end of the line the compiler is pointing to.',
  },
  {
    pattern: /expected primary-expression/i,
    translate: () =>
      'Syntax error — the compiler expected a value (number, variable, expression) but found something else.',
    suggestion: () =>
      'Check for typos, missing operators, or incomplete expressions near this line.',
  },
  {
    pattern: /expected unqualified-id/i,
    translate: () =>
      'Syntax error — there is an unexpected keyword, extra semicolon, or misplaced character.',
    suggestion: () =>
      'Look for stray semicolons, misplaced keywords, or a missing opening brace.',
  },
  {
    pattern: /expected [''""](.+?)[''""] before [''""](.+?)[''""].*/i,
    translate: (m) =>
      `Missing ${m[1]} before ${m[2]}. The compiler expected to see '${m[1]}' at this point.`,
    suggestion: (m) =>
      `Add '${m[1]}' before '${m[2]}', or check for a missing bracket/parenthesis earlier.`,
  },
  {
    pattern: /stray [''""]\\(\d+)[''""] in program/i,
    translate: (m) =>
      `Invalid character (ASCII ${m[1]}) in the source code. This is usually caused by copy-pasting from a website or word processor.`,
    suggestion: () =>
      'Delete the invisible character and retype that part of the code. Use a plain text editor to avoid "smart quotes" or special characters.',
  },
  {
    pattern: /stray [''""](.+?)[''""] in program/i,
    translate: (m) =>
      `Invalid character '${m[1]}' in the source code. This character is not valid in C/C++.`,
    suggestion: () =>
      'Delete the character and retype it. This often happens from copy-pasting code from websites.',
  },

  // --- Function call errors ---
  {
    pattern: /no matching function for call to [''""](.+?)[''""]$/i,
    translate: (m) =>
      `Wrong arguments for '${m[1]}'. You're calling this function with the wrong number or types of arguments.`,
    suggestion: () =>
      'Check the function signature — make sure you have the right number of arguments and each one is the correct type.',
  },
  {
    pattern: /too few arguments to function [''""](.+?)[''""]$/i,
    translate: (m) =>
      `Not enough arguments passed to '${m[1]}'. The function requires more parameters than you provided.`,
    suggestion: () =>
      'Check the function signature and add the missing arguments.',
  },
  {
    pattern: /too many arguments to function [''""](.+?)[''""]$/i,
    translate: (m) =>
      `Too many arguments passed to '${m[1]}'. You provided more parameters than the function accepts.`,
    suggestion: () =>
      'Remove the extra arguments. Check the function signature for the correct parameter count.',
  },
  {
    pattern: /implicit declaration of function [''""](.+?)[''""]$/i,
    translate: (m) =>
      `The function '${m[1]}' is being used before it is declared or defined.`,
    suggestion: () =>
      'Add a function prototype before the call, or add the #include for the library that defines it.',
  },

  // --- Type errors ---
  {
    pattern: /invalid conversion from [''""](.+?)[''""] to [''""](.+?)[''""]$/i,
    translate: (m) =>
      `Type mismatch: trying to use a '${m[1]}' value where a '${m[2]}' is expected.`,
    suggestion: () =>
      'Use an explicit cast, or change the variable type to match what the function expects.',
  },
  {
    pattern: /cannot convert [''""](.+?)[''""] to [''""](.+?)[''""]$/i,
    translate: (m) =>
      `Cannot convert from '${m[1]}' to '${m[2]}'. These types are incompatible.`,
    suggestion: () =>
      'Check the variable types. You may need an explicit cast or need to use a different variable.',
  },
  {
    pattern: /incompatible types/i,
    translate: () =>
      'The types don\'t match. You\'re assigning or returning a value of the wrong type.',
    suggestion: () =>
      'Check both sides of the assignment. Make sure the value type matches what is expected.',
  },

  // --- Class/member errors ---
  {
    pattern: /[''""]class (.+?)[''""] has no member named [''""](.+?)[''""]$/i,
    translate: (m) =>
      `The '${m[1]}' object doesn't have a method or property called '${m[2]}'.`,
    suggestion: (m) =>
      `Check the documentation for '${m[1]}' to see available methods and properties. Watch for typos in '${m[2]}'.`,
  },
  {
    pattern: /request for member [''""](.+?)[''""] in [''""](.+?)[''""].*which is of non-class type/i,
    translate: (m) =>
      `Trying to use '.${m[1]}' on '${m[2]}', but '${m[2]}' is not an object — it's a primitive type.`,
    suggestion: () =>
      'You may be using dot notation on a pointer (use -> instead) or on a non-object type.',
  },

  // --- Redefinition / multiple definition ---
  {
    pattern: /redefinition of [''""](.+?)[''""]$/i,
    translate: (m) =>
      `'${m[1]}' is defined more than once. The same name is used in two different places.`,
    suggestion: () =>
      'Rename one of the definitions, or use #ifndef include guards to prevent double inclusion.',
  },
  {
    pattern: /multiple definition of [''""](.+?)[''""]$/i,
    translate: (m) =>
      `The linker found '${m[1]}' defined in more than one file.`,
    suggestion: () =>
      'Move the definition to a single .cpp file and use extern declarations in headers.',
  },
  {
    pattern: /conflicting declaration [''""](.+?)[''""]$/i,
    translate: (m) =>
      `'${m[1]}' is declared with different types in different places.`,
    suggestion: () =>
      'Make sure all declarations of this name use the same type.',
  },

  // --- Linker errors ---
  {
    pattern: /undefined reference to [''""`](.+?)[''""`]$/i,
    translate: (m) =>
      `The linker can't find the code for '${m[1]}'. It was declared but never actually written or included.`,
    suggestion: () =>
      'Make sure the function is defined (not just declared). Check that the right library is installed and linked.',
  },

  // --- Include / library errors ---
  {
    pattern: /(.+?): No such file or directory/i,
    translate: (m) =>
      `The file '${m[1]}' can't be found. This usually means a library is not installed.`,
    suggestion: () =>
      'Install the library via the Library Manager, or check the #include path for typos.',
  },

  // --- Return / control flow ---
  {
    pattern: /control reaches end of non-void function/i,
    translate: () =>
      'This function is supposed to return a value, but some code paths reach the end without a return statement.',
    suggestion: () =>
      'Add a return statement at the end of every possible code path, including after else/switch/default.',
  },
  {
    pattern: /return-statement with no value/i,
    translate: () =>
      'A return statement is used without a value in a function that is supposed to return something.',
    suggestion: () =>
      'Either add a return value, or change the function return type to void.',
  },

  // --- Array / memory ---
  {
    pattern: /array subscript.*out of range/i,
    translate: () =>
      'Array index is out of the valid range. You\'re trying to access an element that doesn\'t exist.',
    suggestion: () =>
      'Check that your index is between 0 and (array size - 1). Verify loop bounds.',
  },
  {
    pattern: /variable[- ]length array/i,
    translate: () =>
      'Variable-length arrays (where the size is a variable, not a constant) are not standard in C++.',
    suggestion: () =>
      'Use a constant (#define or const int) for the array size, or use dynamic allocation.',
  },
  {
    pattern: /section [''""]\.text[''""] will not fit/i,
    translate: () =>
      'The compiled program is too large to fit in the microcontroller\'s flash memory.',
    suggestion: () =>
      'Reduce code size: remove unused libraries, use F() for strings, optimize logic. Consider a board with more flash.',
  },
  {
    pattern: /region [''""]?(?:RAM|data)[''""]?\s*overflowed/i,
    translate: () =>
      'The program uses more RAM than the microcontroller has available.',
    suggestion: () =>
      'Reduce RAM usage: use PROGMEM for constant data, reduce global variable sizes, use smaller buffers.',
  },

  // --- const / read-only ---
  {
    pattern: /read-only variable [''""](.+?)[''""]$/i,
    translate: (m) =>
      `Can't modify '${m[1]}' because it was declared as const (read-only).`,
    suggestion: () =>
      'Remove the const qualifier if you need to modify this variable, or use a different variable.',
  },
  {
    pattern: /lvalue required/i,
    translate: () =>
      'The left side of the assignment must be a variable that can hold a value, not an expression or constant.',
    suggestion: () =>
      'Make sure you\'re assigning to a variable name, not to a function call or computation result.',
  },

  // --- String / character ---
  {
    pattern: /unterminated.*(?:string|character)/i,
    translate: () =>
      'A string or character literal is missing its closing quote.',
    suggestion: () =>
      'Check for missing closing quotes (" or \'). Make sure quotes are balanced.',
  },

  // --- Warnings that are helpful to explain ---
  {
    pattern: /unused variable [''""](.+?)[''""]$/i,
    translate: (m) =>
      `The variable '${m[1]}' is declared but never used in the code.`,
    suggestion: (m) =>
      `Remove the declaration of '${m[1]}' if it's not needed, or prefix with (void)${m[1]} to suppress this warning.`,
  },
  {
    pattern: /comparison between signed and unsigned/i,
    translate: () =>
      'You\'re comparing a signed number (can be negative) with an unsigned number (always positive). This can produce unexpected results.',
    suggestion: () =>
      'Cast one value to match the other\'s type, or change the variable declaration to use the same signedness.',
  },
  {
    pattern: /suggest parentheses/i,
    translate: () =>
      'The compiler thinks the operator precedence might not be what you intended, and adding parentheses would make the meaning clearer.',
    suggestion: () =>
      'Add parentheses around the sub-expression the compiler is warning about.',
  },
  {
    pattern: /will be initialized after/i,
    translate: () =>
      'Class members are being initialized in a different order than they appear in the class definition. C++ always initializes in declaration order.',
    suggestion: () =>
      'Reorder the member initializer list to match the order members are declared in the class.',
  },
  {
    pattern: /ISO C\+\+ forbids/i,
    translate: () =>
      'This code uses a feature or syntax that is not part of standard C++. It might work with some compilers but is not portable.',
    suggestion: () =>
      'Rewrite using standard C++ constructs to ensure compatibility across different boards and compilers.',
  },

  // --- Preprocessor ---
  {
    pattern: /#error\s+(.+)/i,
    translate: (m) =>
      `A #error directive was triggered: "${m[1]}". This is an intentional compile error placed by the library or board author.`,
    suggestion: () =>
      'Check the preprocessor conditions above the #error. You may need to define a macro, select a different board, or update a library.',
  },

  // --- Overflow ---
  {
    pattern: /(?:integer )?overflow/i,
    translate: () =>
      'A number value is too large (or too small) for the data type being used.',
    suggestion: () =>
      'Use a larger data type (e.g., long instead of int, or uint32_t instead of uint16_t).',
  },

  // --- Storage size ---
  {
    pattern: /storage size of [''""](.+?)[''""] isn['']t known/i,
    translate: (m) =>
      `The compiler doesn't know the full definition of type '${m[1]}' — it only has an incomplete declaration.`,
    suggestion: () =>
      'Add the #include that provides the full type definition (not just a forward declaration).',
  },

  // --- Arduino-specific ---
  {
    pattern: /(?:avrdude|esptool).*?(?:not in sync|sync error)/i,
    translate: () =>
      'The upload tool cannot communicate with the board. The board is not responding as expected.',
    suggestion: () =>
      'Check: 1) Correct board selected in profile? 2) Correct serial port? 3) Is another program using the port? 4) Try pressing the reset button while uploading.',
  },
  {
    pattern: /(?:avrdude|esptool).*?(?:device signature|chip id)/i,
    translate: () =>
      'The upload tool detected a different chip than expected. The board selection may be wrong.',
    suggestion: () =>
      'Double-check the board selection in your build profile. Make sure it matches your actual hardware.',
  },
  {
    pattern: /(?:port|serial).*(?:not found|unavailable|busy)/i,
    translate: () =>
      'The serial port is either not found, busy, or unavailable.',
    suggestion: () =>
      'Check: 1) Is the board plugged in? 2) Is another program (Serial Monitor, another IDE) using the port? 3) Try a different USB cable or port.',
  },
];

// ---------------------------------------------------------------------------
// GCC diagnostic line regex (same as cli-error-parser.ts for standalone use)
// ---------------------------------------------------------------------------

const GCC_DIAG_RE =
  /^(.+?):(\d+):(?:(\d+):)?\s*(error|warning|note|fatal error):\s*(.+)$/;

const GENERIC_ERROR_RE = /^(?:Error|Compilation error|Upload error):\s*(.+)$/i;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Translate a single raw compiler error/warning line into plain English.
 *
 * Returns null if the line is not recognized as a diagnostic.
 */
export function translateCompileError(errorLine: string): ErrorTranslation | null {
  const trimmed = errorLine.trim();
  if (!trimmed) {
    return null;
  }

  // Try GCC structured format: file:line:col: severity: message
  const gccMatch = GCC_DIAG_RE.exec(trimmed);
  if (gccMatch) {
    const file = gccMatch[1];
    const lineNumber = parseInt(gccMatch[2], 10);
    const severityRaw = gccMatch[4].toLowerCase().trim();
    const severity: ErrorTranslation['severity'] =
      severityRaw === 'fatal error' ? 'error' : severityRaw === 'warning' ? 'warning' : severityRaw === 'note' ? 'note' : 'error';
    const message = gccMatch[5].trim();

    // Try to find a matching translation rule
    for (const rule of TRANSLATION_RULES) {
      const ruleMatch = message.match(rule.pattern);
      if (ruleMatch) {
        return {
          original: trimmed,
          translated: rule.translate(ruleMatch, trimmed),
          suggestion: rule.suggestion(ruleMatch),
          severity,
          lineNumber,
          file,
        };
      }
    }

    // Fallback: no specific translation, just clean up the message
    return {
      original: trimmed,
      translated: message,
      suggestion: 'Check the code at the indicated line for errors.',
      severity,
      lineNumber,
      file,
    };
  }

  // Try generic Arduino/upload errors
  const genericMatch = GENERIC_ERROR_RE.exec(trimmed);
  if (genericMatch) {
    const message = genericMatch[1].trim();

    for (const rule of TRANSLATION_RULES) {
      const ruleMatch = message.match(rule.pattern);
      if (ruleMatch) {
        return {
          original: trimmed,
          translated: rule.translate(ruleMatch, trimmed),
          suggestion: rule.suggestion(ruleMatch),
          severity: 'error',
        };
      }
    }

    return {
      original: trimmed,
      translated: message,
      suggestion: 'Review the error message and check your project configuration.',
      severity: 'error',
    };
  }

  // Try matching raw lines that may be linker output or other toolchain messages
  for (const rule of TRANSLATION_RULES) {
    const ruleMatch = trimmed.match(rule.pattern);
    if (ruleMatch) {
      return {
        original: trimmed,
        translated: rule.translate(ruleMatch, trimmed),
        suggestion: rule.suggestion(ruleMatch),
        severity: 'error',
      };
    }
  }

  return null;
}

/**
 * Translate all diagnostics in a full compile output blob.
 *
 * Splits on newlines and translates each recognized diagnostic.
 * Non-diagnostic lines are skipped.
 */
export function translateCompileOutput(fullOutput: string): ErrorTranslation[] {
  if (!fullOutput || fullOutput.trim().length === 0) {
    return [];
  }

  const lines = fullOutput.split('\n');
  const translations: ErrorTranslation[] = [];

  for (const line of lines) {
    const translation = translateCompileError(line);
    if (translation) {
      translations.push(translation);
    }
  }

  return translations;
}
