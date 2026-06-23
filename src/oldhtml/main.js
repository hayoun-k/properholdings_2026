// Custom cursor
const cursor = document.getElementById('cursor');
const ring = document.getElementById('cursorRing');
let mx = 0, my = 0, rx = 0, ry = 0;
document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
function animCursor() {
  cursor.style.left = mx + 'px'; cursor.style.top = my + 'px';
  rx += (mx - rx) * 0.12; ry += (my - ry) * 0.12;
  ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
  requestAnimationFrame(animCursor);
}
animCursor();

// Cursor scale on hover
document.querySelectorAll('a, button, .property-card, .partnership-item').forEach(el => {
  el.addEventListener('mouseenter', () => { ring.style.transform = 'translate(-50%,-50%) scale(1.8)'; ring.style.borderColor = 'rgba(201,168,76,0.8)'; });
  el.addEventListener('mouseleave', () => { ring.style.transform = 'translate(-50%,-50%) scale(1)'; ring.style.borderColor = 'rgba(201,168,76,0.5)'; });
});

// Navbar scroll
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 80);
});

// Scroll reveal
const reveals = document.querySelectorAll('.reveal');
const obs = new IntersectionObserver((entries) => {
  entries.forEach((e, i) => {
    if (e.isIntersecting) {
      setTimeout(() => e.target.classList.add('visible'), i * 80);
    }
  });
}, { threshold: 0.1 });
reveals.forEach(r => obs.observe(r));

// BOOKING MODAL
const bookingModal = document.getElementById('bookingModal');
const bmOverlay = document.getElementById('bmOverlay');
const bmClose = document.getElementById('bmClose');

function openBookingModal() {
  bookingModal.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeBookingModal() {
  bookingModal.classList.remove('open');
  document.body.style.overflow = '';
}

if (bmOverlay) bmOverlay.addEventListener('click', closeBookingModal);
if (bmClose) bmClose.addEventListener('click', closeBookingModal);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeBookingModal(); });

// STICKY BOOK BUTTON
const stickyBook = document.getElementById('stickyBook');
if (stickyBook) {
  stickyBook.addEventListener('click', openBookingModal);
  const heroSection = document.getElementById('hero');
  const showAfter = heroSection ? heroSection.offsetHeight * 0.7 : 600;
  window.addEventListener('scroll', () => {
    stickyBook.classList.toggle('visible', window.scrollY > showAfter);
  }, { passive: true });
}

// Testimonials swipe dots (mobile only)
(function () {
  const grid = document.getElementById('testimonialsGrid');
  const dotsEl = document.getElementById('testimonialDots');
  const cards = grid ? Array.from(grid.querySelectorAll('.testimonial-card')) : [];
  if (!grid || !dotsEl || !cards.length) return;

  cards.forEach((_, i) => {
    const dot = document.createElement('div');
    dot.className = 'swipe-dot' + (i === 0 ? ' active' : '');
    dot.addEventListener('click', () => {
      grid.scrollTo({ left: cards[i].offsetLeft - grid.offsetLeft, behavior: 'smooth' });
    });
    dotsEl.appendChild(dot);
  });

  const dots = Array.from(dotsEl.querySelectorAll('.swipe-dot'));

  grid.addEventListener('scroll', () => {
    const scrollLeft = grid.scrollLeft;
    let closest = 0, minDist = Infinity;
    cards.forEach((card, i) => {
      const dist = Math.abs(card.offsetLeft - grid.offsetLeft - scrollLeft);
      if (dist < minDist) { minDist = dist; closest = i; }
    });
    dots.forEach((d, i) => d.classList.toggle('active', i === closest));
  }, { passive: true });
})();

// Partnership item hover activate
document.querySelectorAll('.partnership-item').forEach(item => {
  item.addEventListener('mouseenter', () => {
    document.querySelectorAll('.partnership-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
  });
});
