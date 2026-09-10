import axios from 'axios';

/**
 * Hikvision Access Control / Time & Attendance ISAPI Driver
 * Connects via HTTP/HTTPS ISAPI protocol (Default port: 80 or 8000)
 */
export class HikvisionClient {
  constructor(ip, port = 80, username = 'admin', password = '') {
    this.ip = ip;
    this.port = Number(port);
    this.username = username;
    this.password = password;
    this.baseUrl = `http://${this.ip}:${this.port}/ISAPI`;
  }

  async testConnection() {
    try {
      const url = `${this.baseUrl}/System/deviceInfo`;
      const res = await axios.get(url, {
        auth: {
          username: this.username,
          password: this.password
        },
        timeout: 6000
      });
      return { success: true, data: res.data };
    } catch (err) {
      // Digest Auth or connection error
      if (err.response && err.response.status === 401) {
        throw new Error('فشل تسجيل الدخول لجهاز Hikvision: اسم المستخدم أو كلمة المرور غير صحيحة.');
      }
      throw new Error(`تعذر الوصول لجهاز Hikvision (${this.ip}:${this.port}): ${err.message}`);
    }
  }

  /**
   * Search attendance / access control events in Hikvision ISAPI
   * @param {string} startTime ISO string (e.g. 2026-09-10T00:00:00)
   * @param {string} endTime ISO string (e.g. 2026-09-10T23:59:59)
   */
  async getEvents(startTime, endTime) {
    try {
      const url = `${this.baseUrl}/AccessControl/AcsEvent?format=json`;
      
      const payload = {
        AcsEventCond: {
          searchID: 'smartcut_' + Date.now(),
          searchResultPosition: 0,
          maxResults: 1000,
          major: 5, // 5 = Major event for access control / door / attendance
          minor: 0,
          startTime: startTime,
          endTime: endTime
        }
      };

      const res = await axios.post(url, payload, {
        auth: {
          username: this.username,
          password: this.password
        },
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      const events = [];
      const infoList = res.data?.AcsEvent?.InfoList || [];
      
      for (const item of infoList) {
        // employeeNoString or cardNo
        const code = item.employeeNoString || item.cardNo;
        const time = item.time; // ISO format from Hikvision
        if (code && time) {
          events.push({
            userSn: String(code),
            recordTime: time,
            verifyState: item.attendanceStatus || (item.eventDescription?.includes('Out') ? 1 : 0)
          });
        }
      }

      return events;
    } catch (err) {
      console.warn('Hikvision event search error:', err.message);
      return [];
    }
  }
}
