// dsh-skill-vault · 归档解包（零依赖）
//
// 只处理三种最常见的技能分发形态：
//   *.zip            —— central directory + stored/deflate
//   *.tar.gz / .tgz  —— gunzip 后按 tar 块解析
//   *.md / 纯文本     —— 直接当扁平技能
//
// 解包目标永远在库目录的临时区里，写入前逐个校验相对路径，
// 拒绝绝对路径与 `..`（zip slip）。

import { promises as fs } from "node:fs";
import { join, dirname, normalize, sep, isAbsolute } from "node:path";
import zlib from "node:zlib";

/** 把压缩包里的相对路径规整成安全路径，越界返回 null。 */
function safeRelPath(name) {
  const cleaned = name.replace(/\\/g, "/").replace(/^\/+/, "");
  if (cleaned === "" || cleaned.endsWith("/")) return null;
  const normalized = normalize(cleaned).replace(/\\/g, "/");
  if (isAbsolute(normalized) || normalized.split("/").includes("..")) return null;
  return normalized;
}

async function writeEntry(targetDir, relPath, data) {
  const safe = safeRelPath(relPath);
  if (safe === null) return false;
  const full = join(targetDir, safe.split("/").join(sep));
  await fs.mkdir(dirname(full), { recursive: true });
  await fs.writeFile(full, data);
  return true;
}

// ---------- zip ----------

function findEocd(buffer) {
  const maxBack = Math.min(buffer.length, 66 * 1024);
  for (let i = buffer.length - 22; i >= buffer.length - maxBack; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) return i;
  }
  return -1;
}

/**
 * 解一个 zip 到目录。
 * @returns {Promise<number>} 写出的文件数
 */
export async function unzipTo(buffer, targetDir) {
  const eocd = findEocd(buffer);
  if (eocd === -1) throw new Error("不是有效的 zip（找不到 EOCD）");
  const entryCount = buffer.readUInt16LE(eocd + 10);
  let pointer = buffer.readUInt32LE(eocd + 16);
  let written = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(pointer) !== 0x02014b50) throw new Error("zip central directory 损坏");
    const method = buffer.readUInt16LE(pointer + 10);
    const compressedSize = buffer.readUInt32LE(pointer + 20);
    const uncompressedSize = buffer.readUInt32LE(pointer + 24);
    const nameLength = buffer.readUInt16LE(pointer + 28);
    const extraLength = buffer.readUInt16LE(pointer + 30);
    const commentLength = buffer.readUInt16LE(pointer + 32);
    const localOffset = buffer.readUInt32LE(pointer + 42);
    const name = buffer.toString("utf8", pointer + 46, pointer + 46 + nameLength);
    pointer += 46 + nameLength + extraLength + commentLength;

    if (name.endsWith("/")) continue;
    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(`zip local header 损坏：${name}`);
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const raw = buffer.subarray(dataStart, dataStart + compressedSize);
    let data;
    if (method === 0) data = raw;
    else if (method === 8) data = zlib.inflateRawSync(raw);
    else throw new Error(`不支持的 zip 压缩方式 ${method}（${name}）`);
    if (uncompressedSize !== 0 && data.length !== uncompressedSize) {
      throw new Error(`zip 条目长度不符：${name} ${data.length} != ${uncompressedSize}`);
    }
    if (await writeEntry(targetDir, name, data)) written += 1;
  }
  return written;
}

// ---------- tar / tar.gz ----------

function tarString(buffer, start, length) {
  const slice = buffer.subarray(start, start + length);
  const end = slice.indexOf(0);
  return slice.toString("utf8", 0, end === -1 ? slice.length : end);
}

/**
 * 解一个 tar（已是明文）到目录。
 * @returns {Promise<number>} 写出的文件数
 */
export async function untarTo(buffer, targetDir) {
  let offset = 0;
  let written = 0;
  let longName = "";
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = longName !== "" ? longName : tarString(header, 0, 100);
    longName = "";
    const prefix = tarString(header, 345, 155);
    const sizeText = tarString(header, 124, 12).trim();
    const size = sizeText === "" ? 0 : parseInt(sizeText, 8);
    const typeflag = String.fromCharCode(header[156] || 48);
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;
    const fullName = prefix !== "" ? `${prefix}/${name}` : name;
    offset = dataStart + Math.ceil(size / 512) * 512;

    if (typeflag === "L") { longName = buffer.toString("utf8", dataStart, dataEnd).replace(/\0+$/, ""); continue; }
    if (typeflag === "5" || typeflag === "x" || typeflag === "g") continue;
    if (size === 0) continue;
    if (await writeEntry(targetDir, fullName, buffer.subarray(dataStart, dataEnd))) written += 1;
  }
  return written;
}

export async function gunzipTo(buffer, targetDir) {
  return untarTo(zlib.gunzipSync(buffer), targetDir);
}

/** 按扩展名解包到目录，返回写出的文件数。 */
export async function extractArchive(fileName, targetDir) {
  const lower = fileName.toLowerCase();
  const buffer = await fs.readFile(fileName);
  if (lower.endsWith(".zip")) return unzipTo(buffer, targetDir);
  if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) return gunzipTo(buffer, targetDir);
  if (lower.endsWith(".tar")) return untarTo(buffer, targetDir);
  throw new Error(`不认识的压缩包类型：${fileName}`);
}
