const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

function insetWindowsBelow(reservedTop, excludeNames = []) {
  if (process.platform !== 'darwin') return Promise.resolve();

  const excludeChecks = excludeNames
    .map((name) => `procName is not "${name.replace(/"/g, '\\"')}"`)
    .join(' and ');
  const excludeCondition = excludeChecks || 'true';

  const script = `
tell application "System Events"
  repeat with proc in (every application process whose visible is true)
    set procName to name of proc
    if ${excludeCondition} then
      tell proc
        repeat with w in windows
          try
            set winPos to position of w
            set winSize to size of w
            set winX to item 1 of winPos
            set winY to item 2 of winPos
            set winW to item 1 of winSize
            set winH to item 2 of winSize
            if winY < ${reservedTop} then
              set overlap to ${reservedTop} - winY
              set newH to winH - overlap
              if newH < 120 then set newH to 120
              set position of w to {winX, ${reservedTop}}
              set size of w to {winW, newH}
            end if
          end try
        end repeat
      end tell
    end if
  end repeat
end tell
`;

  return execFileAsync('osascript', ['-e', script]).catch((err) => {
    console.warn('Could not adjust window positions (grant Accessibility access):', err.message);
  });
}

module.exports = { insetWindowsBelow };
