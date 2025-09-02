const firebaseConfig = {
  apiKey: "AIzaSyATS06KXxMuy2IiB9bHnx0BWdV7P7-qVKY",
  authDomain: "ariline-43d35.firebaseapp.com",
  databaseURL: "https://ariline-43d35-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ariline-43d35",
  storageBucket: "ariline-43d35.firebasestorage.app",
  messagingSenderId: "792343201777",
  appId: "1:792343201777:web:7376e27ad3b1c57cb9a650",
  measurementId: "G-CYGVT2GR96"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

let currentUID = "";
let selectedSeats = [];

const authCard = document.getElementById('authCard');
const dashboard = document.getElementById('dashboard');
const signupBtn = document.getElementById('signupBtn');
const signinBtn = document.getElementById('signinBtn');
const logoutBtn = document.getElementById('logoutBtn');
const bookingPassengers = document.getElementById('bookingPassengers');
const seatmapTable = document.getElementById('seatmapTable');
const pricePreview = document.getElementById('pricePreview');
const signinError = document.getElementById('signinError');

auth.onAuthStateChanged(user => {
  if (user) {
    currentUID = user.uid;
    authCard.style.display = 'none';
    dashboard.style.display = 'block';
  } else {
    dashboard.style.display = 'none';
    authCard.style.display = 'block';
  }
});

signupBtn.onclick = () => {
  auth.createUserWithEmailAndPassword(signupEmail.value, signupPassword.value)
    .then(() => alert("Signup successful! Please sign in."))
    .catch(err => alert(err.message));
}

signinBtn.onclick = () => {
  auth.signInWithEmailAndPassword(signinEmail.value, signinPassword.value)
    .catch(err => signinError.innerText = err.message);
}

logoutBtn.onclick = () => auth.signOut();

bookingPassengers.addEventListener('change', () => {
  const count = parseInt(bookingPassengers.value) || 0;
  const container = document.getElementById('passengerDetailsContainer');
  container.innerHTML = '';

  for (let i = 1; i <= count; i++) {
    container.innerHTML += `
      <h4>Passenger ${i}</h4>
      <input class="passengerName" placeholder="Full Name of Passenger ${i}">
      <input class="passengerPhone" placeholder="Phone Number of Passenger ${i}">
      <input class="passengerAadhar" placeholder="Aadhar Number of Passenger ${i}">
    `;
  }
});

function calcPrice(cls, from, to) {
  const basePrices = { 'Economy': 2000, 'Business': 4000, 'First': 6000 };
  return from !== to ? basePrices[cls] : 0;
}

function loadSeatMap() {
  selectedSeats = [];
  const rows = 6, cols = 6;
  const types = ['W', 'A', 'O', 'O', 'A', 'W'];

  db.ref('seats').once('value', snap => {
    const booked = snap.val() || {};
    seatmapTable.innerHTML = '';

    db.ref('bookings/' + currentUID).once('value', snap2 => {
      const myBookings = snap2.val() || {};
      const mySeats = new Set();
      Object.values(myBookings).forEach(b => b.seat && mySeats.add(b.seat));

      for (let r = 1; r <= rows; r++) {
        const tr = seatmapTable.insertRow();
        for (let c = 0; c < cols; c++) {
          const id = `${r}${String.fromCharCode(65 + c)}`;
          const td = tr.insertCell();
          td.innerText = id;
          if (booked[id]) {
            td.className = mySeats.has(id) ? 'user-seat' : 'booked';
          } else {
            td.className = 'available';
          }
        }
      }

      const from = document.getElementById('fromLocation').value;
      const to = document.getElementById('toLocation').value;
      const price = calcPrice(document.getElementById('bookingClass').value, from, to);
      pricePreview.innerText = `Estimated Price: ₹${price * mySeats.size}`;
    });
  });
}

function bookSeats() {
  const from = document.getElementById('fromLocation').value;
  const to = document.getElementById('toLocation').value;
  const travelDate = document.getElementById('travelDate').value;
  const bookingClass = document.getElementById('bookingClass').value;
  const seatType = document.getElementById('seatType').value;
  const total = +bookingPassengers.value || 1;

  if (!travelDate) return alert("Please select a travel date.");
  if (from === to) return alert("From and To locations cannot be the same.");

  const types = ['W', 'A', 'O', 'O', 'A', 'W'];
  const prefMatch = { 'Window': 'W', 'Aisle': 'A', 'Other': 'O' }[seatType];
  selectedSeats = [];
  let assigned = 0;

  const names = Array.from(document.getElementsByClassName('passengerName')).map(e => e.value.trim());
  const phones = Array.from(document.getElementsByClassName('passengerPhone')).map(e => e.value.trim());
  const aadhars = Array.from(document.getElementsByClassName('passengerAadhar')).map(e => e.value.trim());

  // validation
  for (let i = 0; i < total; i++) {
    if (!names[i] || !/^\d{10}$/.test(phones[i]) || !/^\d{12}$/.test(aadhars[i])) {
      return alert(`Invalid details for Passenger ${i + 1}`);
    }
  }

  db.ref('seats').once('value', snap => {
    const booked = snap.val() || {};

    // Step 1: Try preference seats first
    for (let r = 1; r <= 6 && assigned < total; r++) {
      for (let c = 0; c < 6 && assigned < total; c++) {
        const id = `${r}${String.fromCharCode(65 + c)}`;
        if (!booked[id] && types[c] === prefMatch) {
          selectedSeats.push(id);
          assigned++;
        }
      }
    }

    // Step 2: Fill remaining seats with any available
    for (let r = 1; r <= 6 && assigned < total; r++) {
      for (let c = 0; c < 6 && assigned < total; c++) {
        const id = `${r}${String.fromCharCode(65 + c)}`;
        if (!booked[id] && !selectedSeats.includes(id)) {
          selectedSeats.push(id);
          assigned++;
        }
      }
    }

    if (selectedSeats.length < total) return alert("Not enough seats available.");

    // save to Firebase
    selectedSeats.forEach((seat, i) => {
      const booking = {
        name: names[i],
        phone: phones[i],
        aadhar: aadhars[i],
        class: bookingClass,
        preference: seatType,
        from, to, date: travelDate,
        seat
      };
      db.ref('seats/' + seat).set(true);
      db.ref('bookings/' + currentUID).push(booking);
    });

    const price = calcPrice(bookingClass, from, to) * total;
    alert(`Booking successful!\nSeats: ${selectedSeats.join(', ')}\nTotal Price: ₹${price}`);
    loadSeatMap();
  });
}


function cancelTicket() {
  if (!confirm("Are you sure you want to cancel all your booked tickets?")) return;
  db.ref('bookings/' + currentUID).once('value', snap => {
    const bookings = snap.val();
    if (!bookings) return alert("No bookings to cancel.");
    const allSeats = [];
    Object.values(bookings).forEach(b => b.seat && allSeats.push(b.seat));
    allSeats.forEach(seat => db.ref('seats/' + seat).remove());
    db.ref('bookings/' + currentUID).remove();
    alert("All your tickets have been cancelled.");
    loadSeatMap();
  });
}

function openAdminPanel() {
  db.ref('bookings').once('value', snap => {
    const allBookings = snap.val();
    if (!allBookings) return alert("No bookings found.");
    let msg = "Admin Booking Summary:\n";
    Object.values(allBookings).forEach(userBookings => {
      Object.values(userBookings).forEach(b => {
        msg += `Passenger: ${b.name}, ${b.from} → ${b.to}, Seat: ${b.seat}, Date: ${b.date}\n`;
      });
    });
    alert(msg);
  });
}
