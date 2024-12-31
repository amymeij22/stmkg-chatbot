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
              setChatHistory((history) => [...history, { role: "model", text: "Silahkan masukkan nama desa/kelurahan yang valid " }]);
            }
          } else {
            setChatHistory((history) => [...history, { role: "model", text: "Desa/kelurahan tidak tersedia" }]);
          }
          setLoading(false);
        } else {
          setChatHistory((history) => [...history, { role: "model", text: "Untuk mendapatkan informasi prakiraan cuaca silahkan gunakan format 'cuaca nama desa/kelurahan'" }]);
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
          setChatHistory((history) => [...history, { role: "model", text: "Untuk informasi gempa yang tersedia antara lain: Gempa Terkini, Gempa 5+, dan Gempa Dirasakan. Silahkan ketik informasi gempa yang anda inginkan" }]);
        }
      } else {
        setLoading(true);

        const botResponseData = chatHistory.map(({ role, text }) => ({ role, text }));
        generateBotResponse([
          ...botResponseData,
          { role: "user", text: `Jika saya bilang terima kasih maka jawab dengan Terima kasih telah menggunakan STMKG Chatbot! Saya siap membantu kapan saja Anda membutuhkan informasi lebih lanjut atau memiliki pertanyaan seputar STMKG. Jangan ragu untuk menghubungi saya jika Anda membutuhkan bantuan. Jika saya tanya siapa yang membuatmu maka jawab saya dibuat oleh Ahmad Meijlan Yasir menggunakan model Google Gemini.
            Anggap kamu merupakan Asisten Chatbot untuk Sekolah Tinggi Meteorologi Klimatologi dan Geofisika. Gunakan informasi yang telah disediakan ini untuk menjawab pertanyaan berikut: ${userMessage}. Jika informasi tersebut tidak mencakup pertanyaan ini, silakan gunakan pengetahuan kamu sendiri tanpa mengatakan bahwa hal tersebut tidak ada di informasi yang sudah ada!. ` },
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