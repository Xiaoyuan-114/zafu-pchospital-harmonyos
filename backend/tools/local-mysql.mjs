import { loadEnvFile } from "node:process";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import mariadb from "mariadb";

// Only manages the separate course database instance configured locally.
loadEnvFile(".env.local-admin");
const url = new URL(process.env.LOCAL_MYSQL_ADMIN_URL ?? "");
if (url.protocol !== "mysql:" || url.hostname !== "127.0.0.1" || !url.port) {
  throw new Error("LOCAL_MYSQL_ADMIN_URL must identify the dedicated loopback instance");
}
const dataDirectory = path.resolve(process.env.LOCAL_MYSQL_DATA_DIRECTORY ?? "");
if (!process.env.LOCAL_MYSQL_DATA_DIRECTORY || !existsSync(path.join(dataDirectory, "auto.cnf"))) {
  throw new Error("Dedicated initialized LOCAL_MYSQL_DATA_DIRECTORY is required");
}
const bin = process.env.LOCAL_MYSQL_BIN_DIRECTORY ?? "C:/Program Files/MySQL/MySQL Server 9.6/bin";
const mode = process.argv[2];
if (mode === "start") {
  const child = spawn(
    path.join(bin, "mysqld.exe"),
    [
      "--no-defaults",
      `--basedir=${path.dirname(bin)}`,
      `--datadir=${dataDirectory}`,
      `--port=${url.port}`,
      "--mysqlx=OFF",
      "--bind-address=127.0.0.1",
      `--log-error=${path.join(dataDirectory, "mysql-error.log")}`,
      `--pid-file=${path.join(dataDirectory, "mysql.pid")}`,
    ],
    { detached: true, stdio: "ignore", windowsHide: true },
  );
  child.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  child.unref();
  console.log(
    `Requested local MySQL startup at 127.0.0.1:${url.port}; check db:health and mysql-error.log`,
  );
} else if (mode === "stop") {
  const connection = await mariadb.createConnection({
    host: url.hostname,
    port: Number(url.port),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    allowPublicKeyRetrieval: true,
  });
  try {
    await connection.query("SHUTDOWN");
  } finally {
    await connection.end();
  }
  console.log(`Stopped dedicated local MySQL at 127.0.0.1:${url.port}; data retained`);
} else throw new Error("Usage: node tools/local-mysql.mjs start|stop");
