import { useRef, useState } from "react";
import PropTypes from "prop-types";

// Helper function to fetch the code from the CSV data
const fetchRegionCode = async (regionName) => {
  if (!regionName) return null;

  try {
    const response = await fetch(
      "https://raw.githubusercontent.com/kodewilayah/permendagri-72-2019/main/dist/base.csv"
    );
    const text = await response.text();
    const rows = text.split("\n");

    const normalizedRegionName = regionName.toLowerCase();

    for (const row of rows) {
      const [code, name] = row.split(",");
      if (name && name.toLowerCase().includes(normalizedRegionName)) {
        return code; // Return the region code that matches
      }
    }
  } catch (error) {
    console.error("Error fetching region code:", error);
  }
  return null;
};

// Helper function to fetch weather data from BMKG API
const fetchWeatherData = async (regionCode) => {
  try {
    const response = await fetch(
      `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${regionCode}`
    );
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching weather data:", error);
    return null;
  }
};

// Helper function to fetch earthquake data from BMKG API
const fetchEarthquakeData = async (type) => {
  let url = "";
  switch (type) {
    case "terkini":
      url = "https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json";
      break;
    case "5+":
      url = "https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json";
      break;
    case "dirasakan":
      url = "https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json";
      break;
    default:
      return null;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching earthquake data:", error);
    return null;
  }
};

// Helper function to format weather data into a readable string
const formatWeatherData = (data) => {
  if (!data || !data.data || !data.data.length) {
    return "Mohon maaf, data prakiraan tidak tersedia.";
  }

  const location = data.data[0].lokasi;
  const locationInfo = `[INFORMASI PRAKIRAAN CUACA INDONESIA]

📍Lokasi:
Desa: ${location.desa}
Kecamatan: ${location.kecamatan}
Kabupaten: ${location.kotkab}
Provinsi: ${location.provinsi}
`;

  const forecasts = data.data.flatMap((entry) => {
    return entry.cuaca.flatMap((weatherArray) => {
      return weatherArray.map((weatherEntry) => {
        const date = new Date(weatherEntry.local_datetime);
        if (isNaN(date.getTime())) {
          return "Invalid date format.";
        }

        const localDateStr = new Intl.DateTimeFormat("id-ID", {
          year: "numeric",
          month: "numeric",
          day: "numeric",
        }).format(date);

        const localTimeStr = new Intl.DateTimeFormat("id-ID", {
          hour: "numeric",
          minute: "numeric",
          second: "numeric",
          timeZone: "Asia/Jakarta",
        }).format(date);

        const weatherDesc = weatherEntry.weather_desc || "No description available";
        const temp = weatherEntry.t !== undefined ? `${weatherEntry.t}°C` : "No temperature data";
        const humidity = weatherEntry.hu !== undefined ? `${weatherEntry.hu}%` : "No humidity data";
        const windSpeed = weatherEntry .ws !== undefined ? `${weatherEntry.ws} km/h` : "No wind speed data";
        const windDirection = weatherEntry.wd_to || "No wind direction data";
        const visibility = weatherEntry.vs_text || "No visibility data";

        return `
-----------------------------
  📅 Tanggal: ${localDateStr}
  ⏰ Pukul: ${localTimeStr}
  ☀ Kondisi: ${weatherDesc}
  🌡️ Suhu: ${temp}
  💧 Kelembapan: ${humidity}
  💨 Angin: ${windSpeed} (${windDirection})
  ☁️ Awan: ${weatherEntry.weather_desc || "No cloud data"}
  👀 Jarak Pandang: ${visibility}`;
      });
    });
  }).join("");

  return `${locationInfo}${forecasts}\n\n-----------------------------\nSumber data :\nBadan Meteorologi Klimatologi dan Geofisika`;
};

// Helper function to format earthquake data into a readable string
const formatEarthquakeData = (data, type) => {
  if (!data || !data.Infogempa) {
    return "Mohon maaf, data gempa tidak tersedia.";
  }

  let message = `[INFORMASI GEMPA ${type.toUpperCase()}]\n`;
  if (type === "terkini" || type === "terbaru") {
    const earthquake = data.Infogempa.gempa;
    const shakeMapUrl = `https://data.bmkg.go.id/DataMKG/TEWS/${earthquake.Shakemap}`;
    
    message += `
  📅 Tanggal: ${earthquake.Tanggal}
  ⏰ Jam: ${earthquake.Jam}
  🌍 Magnitude: ${earthquake.Magnitude}
  🌊 Kedalaman: ${earthquake.Kedalaman}
  📍 Wilayah: ${earthquake.Wilayah}
  💬 Potensi: ${earthquake.Potensi}
  📍 Dirasakan: ${earthquake.Dirasakan || "Tidak ada data"}
  🖼️ ShakeMap:\nSilahkan akses tautan berikut untuk melihat shakemap: \n ${shakeMapUrl}`;

  } else {
    const earthquakes = data.Infogempa.gempa;
    earthquakes.forEach((quake) => {
      message += `
  📅 Tanggal: ${quake.Tanggal}
  ⏰ Jam: ${quake.Jam}
  🌍 Magnitude: ${quake.Magnitude}
  🌊 Kedalaman: ${quake.Kedalaman}
  📍 Wilayah: ${quake.Wilayah}
  💬 Potensi: ${quake.Potensi || "Tidak ada data"}`;
    });
  }
  message += `\n\n-----------------------------\nSumber data: Badan Meteorologi Klimatologi dan Geofisika`;
  return { message};
};

// Helper function to extract region name from the user message
const extractRegionName = (message) => {
  const cuacaIndex = message.toLowerCase().indexOf("cuaca");
  if (cuacaIndex !== -1) {
    const regionPart = message.slice(cuacaIndex + 6).trim();
    return regionPart;
  }
  return null;
};

const ChatForm = ({ chatHistory, setChatHistory, generateBotResponse }) => {
  const inputRef = useRef();
  const [loading, setLoading] = useState(false);

  // Array untuk mendeteksi jenis pesan
  const praiseKeywords = ["mantap", "keren", "bagus", "hebat", "wow", "oke", "ok", "sip", "top", "mantab", "mantul", "kece", "cool", "nice", "good", "great", "awesome", "amazing", "excellent", "perfect", "👍", "👏", "🔥", "💯"];
  const greetingKeywords = ["halo", "hai", "hi", "hello", "hey", "p", "pagi", "siang", "sore", "malam", "selamat"];
  const thanksKeywords = ["makasih", "terima kasih", "thx", "thanks", "tq", "thank you", "terimakasih", "tengkyu", "trims"];
  const identityKeywords = ["siapa kamu", "siapa namamu", "siapa yang membuatmu", "siapa pembuatmu", "siapa yang buatmu", "siapa yang buat kamu", "siapa yang menciptakanmu", "siapa penciptamu", "kamu siapa", "kamu dibuat oleh siapa"];
  const casualConversationKeywords = ["apa kabar", "kabar", "lagi ngapain", "lagi apa", "sedang apa", "gimana kabarnya", "how are you", "what's up", "wassup", "wazzup", "apa yang kamu lakukan", "ngapain", "ngopi", "makan"];
  const jokeKeywords = ["lucu", "joke", "lawak", "humor", "lelucon", "candaan", "bercanda", "ketawa", "haha", "wkwk", "wkwkwk", "hehe", "hihi", "😂", "🤣", "😆", "😄"];
  const shortResponses = ["ya", "tidak", "iya", "nggak", "ngga", "ga", "gak", "y", "g", "n", "no", "yes", "yoi", "yup", "nope", "ok", "oke", "baik", "hmm", "hmmmm", "oh", "eh", "ah", "wah", "waduh", "aduh", "yah", "test", "tes", "testing", "coba", "cek"];

  // Fungsi untuk mendapatkan respons acak dari array
  const getRandomResponse = (responses) => {
    return responses[Math.floor(Math.random() * responses.length)];
  };
  
  // Variasi respons untuk berbagai jenis pesan
  const praiseResponses = [
    "Terima kasih banyak atas pujiannya! 😊 Saya senang bisa membantu Anda. Ada yang bisa saya bantu lagi hari ini seputar STMKG atau informasi cuaca dan gempa?",
    "Wah, terima kasih! Apresiasi Anda membuat saya semangat untuk memberikan layanan terbaik. Ada yang ingin Anda tanyakan lagi?",
    "Senang mendengarnya! 😄 Saya akan terus berusaha memberikan informasi yang bermanfaat untuk Anda. Ada hal lain yang bisa saya bantu?",
    "Terima kasih atas kata-kata baik Anda! Saya di sini untuk membantu kapan pun Anda membutuhkan informasi seputar STMKG. Ada yang ingin ditanyakan lagi?"
  ];
  
  const greetingResponses = [
    time => `${time}! Senang bertemu dengan Anda. Ada yang bisa saya bantu seputar informasi STMKG, prakiraan cuaca, atau data gempa hari ini? 😊`,
    time => `${time}! Bagaimana kabar Anda hari ini? Ada yang bisa saya bantu terkait STMKG atau informasi cuaca terkini?`,
    time => `${time}! Saya STMKG Chatbot, siap membantu Anda dengan berbagai informasi. Apa yang ingin Anda ketahui hari ini?`,
    time => `${time}! 👋 Apa ada informasi khusus tentang STMKG, cuaca, atau gempa yang ingin Anda ketahui?`
  ];
  
  const thanksResponses = [
    "Sama-sama! Senang bisa membantu Anda. Jangan ragu untuk bertanya kembali jika ada hal lain yang Anda butuhkan. Semoga hari Anda menyenangkan! 😊",
    "Dengan senang hati! Saya selalu siap membantu kapan pun Anda membutuhkan informasi seputar STMKG. Semoga hari Anda menyenangkan!",
    "Tidak masalah! 😊 Saya senang bisa memberikan informasi yang Anda butuhkan. Jangan ragu untuk kembali jika ada pertanyaan lain.",
    "Terima kasih kembali! Semoga informasi yang saya berikan bermanfaat untuk Anda. Sampai jumpa lagi! 👋"
  ];
  
  const casualConversationResponses = [
    "Kabar saya baik, terima kasih sudah bertanya! 😊 Saya selalu siap membantu Anda dengan informasi seputar STMKG, prakiraan cuaca, dan data gempa. Ada yang ingin Anda tanyakan hari ini?",
    "Saya selalu dalam kondisi prima untuk membantu Anda! 🌟 Ada yang ingin Anda ketahui seputar STMKG atau informasi cuaca terkini?",
    "Terima kasih sudah menanyakan kabar! Saya selalu siap 24/7 untuk membantu Anda dengan informasi STMKG. Ada yang bisa saya bantu hari ini?",
    "Saya baik-baik saja dan siap membantu! Bagaimana dengan Anda? Ada informasi STMKG atau prakiraan cuaca yang Anda butuhkan hari ini?"
  ];
  
  const jokeResponses = [
    "Haha, saya senang Anda memiliki selera humor yang baik! 😄 Meskipun saya hanya chatbot, saya selalu berusaha membuat percakapan menjadi menyenangkan. Ada yang bisa saya bantu seputar STMKG hari ini?",
    "Senang bisa berbagi tawa dengan Anda! 😊 Bagaimana jika kita kembali ke topik STMKG? Ada informasi yang Anda butuhkan?",
    "Humor adalah bagian penting dari komunikasi! 😄 Saya juga suka suasana santai. Ada yang ingin Anda tanyakan tentang STMKG atau prakiraan cuaca?",
    "Tertawa adalah obat terbaik, kata mereka! 😁 Saya senang bisa membuat percakapan ini menyenangkan. Ada yang bisa saya bantu terkait STMKG?"
  ];
  
  const shortResponsesReplies = [
    "Maaf, saya kurang memahami pesan singkat Anda. Bisakah Anda memberikan pertanyaan yang lebih lengkap? Saya siap membantu dengan informasi seputar STMKG, prakiraan cuaca, atau data gempa terkini. 😊",
    "Hmm, sepertinya pesan Anda terlalu singkat untuk saya pahami. Bisa tolong jelaskan lebih detail apa yang ingin Anda ketahui tentang STMKG atau layanan kami?",
    "Saya membutuhkan informasi lebih detail untuk membantu Anda dengan baik. Ada pertanyaan spesifik tentang STMKG, cuaca, atau gempa yang ingin Anda tanyakan?",
    "Untuk memberikan bantuan yang optimal, saya perlu memahami pertanyaan Anda dengan lebih jelas. Bisa tolong berikan pertanyaan yang lebih lengkap? 🙂"
  ];

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const userMessage = inputRef.current.value.trim();
    if (!userMessage) return;
    inputRef.current.value = "";

    setChatHistory((history) => [...history, { role: "user", text: userMessage }]);

    setTimeout(async () => {
      const weatherKeywords = ["cuaca"];
      const earthquakeKeywords = ["gempa", "gempa terkini", "gempa 5+", "gempa dirasakan"];
      const isWeatherQuery = weatherKeywords.some((keyword) =>
        userMessage.toLowerCase().includes(keyword)
      );
      const isEarthquakeQuery = earthquakeKeywords.some((keyword) =>
        userMessage.toLowerCase().includes(keyword)
      );
      
      // Deteksi jenis pesan
      const isPraise = praiseKeywords.some(keyword => userMessage.toLowerCase().includes(keyword));
      const isGreeting = greetingKeywords.some(keyword => userMessage.toLowerCase().includes(keyword));
      const isThanks = thanksKeywords.some(keyword => userMessage.toLowerCase().includes(keyword));
      const isIdentityQuestion = identityKeywords.some(keyword => userMessage.toLowerCase().includes(keyword));
      const isCasualConversation = casualConversationKeywords.some(keyword => userMessage.toLowerCase().includes(keyword));
      const isJoke = jokeKeywords.some(keyword => userMessage.toLowerCase().includes(keyword));
      const isShortResponse = shortResponses.includes(userMessage.toLowerCase()) || userMessage.length <= 2;
      
      // Respons khusus untuk jenis pesan tertentu
      if (isPraise && userMessage.length < 20) {
        setChatHistory((history) => [...history, { role: "model", text: getRandomResponse(praiseResponses) }]);
        return;
      }
      
      if (isGreeting && userMessage.length < 15) {
        const timeNow = new Date().getHours();
        let greeting = "Halo";
        if (timeNow >= 5 && timeNow < 11) greeting = "Selamat pagi";
        else if (timeNow >= 11 && timeNow < 15) greeting = "Selamat siang";
        else if (timeNow >= 15 && timeNow < 19) greeting = "Selamat sore";
        else greeting = "Selamat malam";
        
        const selectedResponse = getRandomResponse(greetingResponses);
        setChatHistory((history) => [...history, { role: "model", text: selectedResponse(greeting) }]);
        return;
      }
      
      if (isThanks && userMessage.length < 20) {
        setChatHistory((history) => [...history, { role: "model", text: getRandomResponse(thanksResponses) }]);
        return;
      }
      
      if (isIdentityQuestion) {
        setChatHistory((history) => [...history, { role: "model", text: "Saya adalah STMKG Chatbot, asisten digital untuk Sekolah Tinggi Meteorologi Klimatologi dan Geofisika. Saya dibuat oleh Ahmad Meijlan Yasir menggunakan model Google Gemini untuk membantu memberikan informasi seputar STMKG, prakiraan cuaca, dan data gempa terkini. Ada yang bisa saya bantu? 🤖" }]);
        return;
      }
      
      if (isCasualConversation && userMessage.length < 25) {
        setChatHistory((history) => [...history, { role: "model", text: getRandomResponse(casualConversationResponses) }]);
        return;
      }
      
      if (isJoke && userMessage.length < 25) {
        setChatHistory((history) => [...history, { role: "model", text: getRandomResponse(jokeResponses) }]);
        return;
      }
      
      if (isShortResponse) {
        setChatHistory((history) => [...history, { role: "model", text: getRandomResponse(shortResponsesReplies) }]);
        return;
      }

      if (isWeatherQuery) {
        const regionName = extractRegionName(userMessage);

        if (regionName) {
          setLoading(true);

          const regionCode = await fetchRegionCode(regionName);
          if (regionCode) {
            const weatherData = await fetchWeatherData(regionCode);
            if (weatherData) {
              const weatherMessage = formatWeatherData(weatherData);
              setChatHistory((history) => [...history, { role: "model", text: weatherMessage }]);
            } else {
              setChatHistory((history) => [...history, { role: "model", text: "Mohon maaf, saya tidak dapat menemukan data cuaca untuk lokasi tersebut. Pastikan Anda menuliskan nama desa/kelurahan dengan benar. Contoh format yang tepat: 'cuaca Tanah Tinggi' atau 'cuaca Pondok Betung'. Jika masih mengalami kesulitan, Anda dapat mencari kode wilayah di https://kodewilayah.id/ untuk memastikan ketersediaan data." }]);
            }
          } else {
            setChatHistory((history) => [...history, { role: "model", text: "Mohon maaf, desa/kelurahan yang Anda cari tidak tersedia dalam database kami. Untuk melihat daftar lengkap kode wilayah di Indonesia, silakan kunjungi situs https://kodewilayah.id/ dan cari berdasarkan provinsi, kabupaten, kecamatan, hingga desa/kelurahan yang Anda inginkan. Setelah itu, Anda dapat mencoba kembali dengan format 'cuaca [nama desa/kelurahan]'." }]);
          }
          setLoading(false);
        } else {
          setChatHistory((history) => [...history, { role: "model", text: "Untuk mendapatkan informasi prakiraan cuaca, silakan gunakan format 'cuaca [nama desa/kelurahan]'. Contoh: 'cuaca Tanah Tinggi' atau 'cuaca Pondok Betung'.\n\nJika Anda tidak yakin dengan nama desa/kelurahan yang tersedia, Anda dapat mengunjungi https://kodewilayah.id/ untuk melihat daftar lengkap wilayah di Indonesia. Saya siap membantu Anda mendapatkan informasi cuaca terkini! 🌤️" }]);
        }
      } else if (isEarthquakeQuery) {
        let type = "";
        if (userMessage.toLowerCase().includes("gempa terkini")) {
          type = "terkini";
        } else if (userMessage.toLowerCase().includes("gempa 5+")) {
          type = "5+";
        } else if (userMessage.toLowerCase().includes("gempa dirasakan")) {
          type = "dirasakan";
        }

        if (type) {
          setLoading(true);

          const earthquakeData = await fetchEarthquakeData(type);
          if (earthquakeData) {
            const { message } = formatEarthquakeData(earthquakeData, type);
            setChatHistory((history) => [
              ...history,
              { role: "model", text: message }
            ]);
          } else {
            setChatHistory((history) => [...history, { role: "model", text: "Data gempa tidak tersedia." }]);
          }
          setLoading(false);
        } else {
          setChatHistory((history) => [...history, { role: "model", text: "Untuk informasi gempa, Anda dapat menggunakan salah satu dari perintah berikut:\n\n• \"gempa terkini\" - untuk informasi gempa terbaru\n• \"gempa 5+\" - untuk informasi gempa dengan kekuatan 5 SR ke atas\n• \"gempa dirasakan\" - untuk informasi gempa yang dirasakan oleh masyarakat\n\nSilakan ketik salah satu perintah di atas untuk mendapatkan informasi gempa yang Anda butuhkan. Data gempa bersumber langsung dari BMKG dan selalu diperbarui. 🌍" }]);
        }
      } else {
        setLoading(true);

        const botResponseData = chatHistory.map(({ role, text }) => ({ role, text }));
        generateBotResponse([
          ...botResponseData,
          { role: "user", text: `Berikut adalah panduan untuk merespons berbagai jenis pesan:

1. PUJIAN (seperti "mantap", "keren", "bagus", "hebat", "wow", dll):
   Jika pesan berisi pujian, balas dengan ucapan terima kasih yang tulus dan alami, misalnya:
   "Terima kasih banyak! Senang bisa membantu Anda. Ada yang bisa saya bantu lagi hari ini?" atau
   "Wah, terima kasih atas pujiannya! Saya berusaha memberikan yang terbaik. Ada hal lain yang ingin Anda tanyakan?"

2. SAPAAN (seperti "halo", "hai", "p", "hi", dll):
   Balas dengan sapaan ramah dan tawaran bantuan, misalnya:
   "Halo! Selamat datang di STMKG Chatbot. Ada yang bisa saya bantu hari ini?" atau
   "Hai! Senang bertemu dengan Anda. Apa ada informasi seputar STMKG yang ingin Anda ketahui?"

3. UCAPAN TERIMA KASIH:
   Jika pesan berisi ucapan terima kasih, balas dengan:
   "Sama-sama! Senang bisa membantu Anda. Jangan ragu untuk bertanya kembali jika ada hal lain yang Anda butuhkan. Semoga hari Anda menyenangkan!"

4. PERTANYAAN TENTANG IDENTITAS:
   Jika ditanya "siapa kamu", "siapa yang membuatmu", dll, jawab:
   "Saya adalah STMKG Chatbot, asisten digital untuk Sekolah Tinggi Meteorologi Klimatologi dan Geofisika. Saya dibuat oleh Ahmad Meijlan Yasir menggunakan model Google Gemini untuk membantu memberikan informasi seputar STMKG."

5. PERCAKAPAN UMUM / BASA-BASI:
   Untuk percakapan umum seperti "apa kabar", "lagi ngapain", dll, berikan respons yang natural dan ramah, lalu arahkan kembali ke konteks STMKG, misalnya:
   "Kabar saya baik, terima kasih sudah bertanya! Saya selalu siap membantu Anda dengan informasi seputar STMKG. Ada yang ingin Anda tanyakan hari ini?"

6. PERTANYAAN DI LUAR KONTEKS:
   Jika ditanya hal di luar konteks STMKG, jawab dengan sopan dan coba kaitkan dengan STMKG jika memungkinkan, misalnya:
   "Meskipun itu di luar informasi utama STMKG, saya akan coba membantu. [Berikan jawaban sesuai pengetahuan umum]. Apakah ada hal lain seputar STMKG yang ingin Anda tanyakan?"

7. PESAN TIDAK JELAS:
   Jika menerima pesan yang tidak jelas atau terlalu singkat, minta klarifikasi dengan ramah:
   "Maaf, saya kurang memahami maksud Anda. Bisakah Anda menjelaskan lebih detail apa yang ingin Anda ketahui? Saya siap membantu dengan informasi seputar STMKG."

8. LELUCON ATAU CANDAAN:
   Tanggapi dengan ramah dan sedikit humor yang sopan:
   "Haha, itu lucu! 😄 Saya senang bisa berbincang santai dengan Anda. Ada yang ingin Anda tanyakan seputar STMKG?"

Untuk semua jenis pesan, pastikan respons Anda:
- Menggunakan bahasa Indonesia yang baik dan benar
- Terasa natural dan mengalir seperti percakapan manusia
- Menggunakan emoji secara wajar (1-2 emoji per respons)
- Memiliki nada yang ramah dan membantu
- Menunjukkan kepribadian yang hangat namun tetap profesional

Sekarang, gunakan panduan di atas untuk merespons pesan berikut: "${userMessage}"

Jika pesan tersebut berisi pertanyaan tentang STMKG, gunakan informasi yang telah disediakan. Jika informasi tidak mencakup pertanyaan tersebut, gunakan pengetahuan umum tanpa menyebutkan bahwa informasi tersebut tidak ada dalam data yang diberikan.` },
        ]).then(() => {
          setLoading(false);
        });
      }
    }, 600);
  };

  return (
    <form onSubmit={handleFormSubmit} className="chat-form">
      <input ref={inputRef} placeholder="Ketik pesan..." className="message-input" required />
      <button type="submit" id="send-message" className="material-icons" disabled={loading}>
        {loading ? "hourglass_empty" : "arrow_upward"}
      </button>
    </form>
  );
};

ChatForm.propTypes = {
  chatHistory: PropTypes.array.isRequired,
  setChatHistory: PropTypes.func.isRequired,
  generateBotResponse: PropTypes.func.isRequired,
};

export default ChatForm;