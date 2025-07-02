import { PythonShell } from "python-shell";

export async function POST(req) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const { code } = await req.json();
  let output = "";

  const options = {
    mode: "text",
    pythonPath: "python3", // Adjust based on your system (e.g., "python" on Windows)
    pythonOptions: ["-c"], // Run code as a string
    scriptPath: "", // Optional: path to scripts if needed
    args: [], // Optional: arguments to pass
  };

  return new Promise((resolve) => {
    PythonShell.runString(code, options, (err, results) => {
      if (err) {
        output = `Error: ${err.message}`;
      } else {
        output = results.join("\n");
      }
      resolve(new Response(JSON.stringify({ output }), { status: 200 }));
    });
  });
}