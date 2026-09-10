import net from 'net';

/**
 * Pure lightweight JavaScript ZK Protocol client for Node.js
 * Supports TCP port 4370 for ZKTeco attendance devices
 */
export class ZKClient {
  constructor(ip, port = 4370, timeout = 5000) {
    this.ip = ip;
    this.port = Number(port);
    this.timeout = timeout;
    this.socket = null;
    this.sessionId = 0;
    this.replyId = 0;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();
      this.socket.setTimeout(this.timeout);

      const timer = setTimeout(() => {
        if (this.socket) {
          this.socket.destroy();
          reject(new Error(`Connection to ZK device at ${this.ip}:${this.port} timed out.`));
        }
      }, this.timeout);

      this.socket.connect(this.port, this.ip, async () => {
        clearTimeout(timer);
        try {
          // Send Connect Command (CMD_CONNECT = 1000)
          const resp = await this.sendCommand(1000);
          if (resp && resp.command === 2000) { // CMD_ACK_OK = 2000
            this.sessionId = resp.sessionId;
            resolve(true);
          } else {
            reject(new Error('ZK Device did not accept connect command.'));
          }
        } catch (err) {
          reject(err);
        }
      });

      this.socket.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  createHeader(command, checksum, sessionId, replyId) {
    const buf = Buffer.alloc(8);
    buf.writeUInt16LE(command, 0);
    buf.writeUInt16LE(checksum, 2);
    buf.writeUInt16LE(sessionId, 4);
    buf.writeUInt16LE(replyId, 6);
    return buf;
  }

  calculateChecksum(p) {
    let chk = 0;
    for (let i = 0; i < p.length; i += 2) {
      if (i === p.length - 1) {
        chk += p[i];
      } else {
        chk += p.readUInt16LE(i);
      }
      chk %= 65536;
    }
    chk = 65536 - chk - 1;
    return chk;
  }

  createTcpPacket(command, data = Buffer.alloc(0)) {
    this.replyId = (this.replyId + 1) % 65536;
    let header = this.createHeader(command, 0, this.sessionId, this.replyId);
    let packet = Buffer.concat([header, data]);
    const chk = this.calculateChecksum(packet);
    header = this.createHeader(command, chk, this.sessionId, this.replyId);
    packet = Buffer.concat([header, data]);

    // TCP Wrapper (ZKTeco TCP Header: 0x5050 0x827D + length + packet)
    const tcpHeader = Buffer.alloc(8);
    tcpHeader.writeUInt16LE(0x5050, 0); // MAGIC 1
    tcpHeader.writeUInt16LE(0x827d, 2); // MAGIC 2
    tcpHeader.writeUInt32LE(packet.length, 4);

    return Buffer.concat([tcpHeader, packet]);
  }

  async sendCommand(command, data = Buffer.alloc(0)) {
    return new Promise((resolve, reject) => {
      if (!this.socket) return reject(new Error('Socket not connected'));

      const reqPacket = this.createTcpPacket(command, data);

      const onData = (chunk) => {
        this.socket.off('data', onData);
        // Parse response
        if (chunk.length >= 16) {
          // Has TCP Wrapper
          const inner = chunk.slice(8);
          const cmd = inner.readUInt16LE(0);
          const chk = inner.readUInt16LE(2);
          const sess = inner.readUInt16LE(4);
          const rep = inner.readUInt16LE(6);
          const body = inner.slice(8);
          resolve({ command: cmd, checksum: chk, sessionId: sess, replyId: rep, data: body });
        } else if (chunk.length >= 8) {
          const cmd = chunk.readUInt16LE(0);
          const chk = chunk.readUInt16LE(2);
          const sess = chunk.readUInt16LE(4);
          const rep = chunk.readUInt16LE(6);
          const body = chunk.slice(8);
          resolve({ command: cmd, checksum: chk, sessionId: sess, replyId: rep, data: body });
        } else {
          resolve({ command: 0, data: chunk });
        }
      };

      this.socket.on('data', onData);
      this.socket.write(reqPacket);
    });
  }

  /**
   * Fetch attendance logs from device
   * Returns array of: { userSn, recordTime, verifyType, verifyState }
   */
  async getAttendanceLogs() {
    try {
      // CMD_ATTLOG_RRQ = 13 (Read Attendance Record Request)
      const res = await this.sendCommand(13);
      if (!res) return [];

      // In standard ZK TCP, if data is small or returned directly
      const logs = [];
      const data = res.data || Buffer.alloc(0);

      // Parse ZKTeco 40-byte or 16-byte record structs
      // Most standalone devices return records formatted as:
      // user_sn (2 bytes or 24 bytes string), time (4 bytes or encoded), verify type (1 byte), state (1 byte)
      // Fallback: If device returns records in chunk stream
      if (data.length >= 40) {
        let offset = 0;
        while (offset + 40 <= data.length) {
          try {
            const userStr = data.slice(offset, offset + 24).toString('ascii').replace(/\0/g, '').trim();
            const timeInt = data.readUInt32LE(offset + 26);
            const state = data.readUInt8(offset + 30);
            
            // Decode ZK Time (encoded as bits or Unix epoch)
            const date = this.decodeTime(timeInt);
            if (userStr && date) {
              logs.push({
                userSn: userStr,
                recordTime: date,
                verifyState: state
              });
            }
          } catch {}
          offset += 40;
        }
      }

      return logs;
    } catch (e) {
      console.warn('ZK read attendance notice:', e.message);
      return [];
    }
  }

  decodeTime(t) {
    if (!t) return null;
    try {
      // ZKTeco compressed time format
      const second = t % 60;
      t = Math.floor(t / 60);
      const minute = t % 60;
      t = Math.floor(t / 60);
      const hour = t % 24;
      t = Math.floor(t / 24);
      const day = (t % 31) + 1;
      t = Math.floor(t / 31);
      const month = t % 12;
      t = Math.floor(t / 12);
      const year = t + 2000;

      const d = new Date(year, month, day, hour, minute, second);
      return isNaN(d.getTime()) ? null : d.toISOString();
    } catch {
      return null;
    }
  }

  async disconnect() {
    if (this.socket) {
      try {
        await this.sendCommand(1001); // CMD_EXIT
      } catch {}
      this.socket.destroy();
      this.socket = null;
    }
  }
}
