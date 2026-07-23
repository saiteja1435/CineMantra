(() => {
    const PLACEHOLDER = '/static/images/placeholder.svg';

    // Curated Telugu celebrity lists by section
    const SECTIONS = {
        heroes: {
            queries: ['Prabhas', 'Mahesh Babu', 'Allu Arjun', 'Jr NTR', 'Ram Charan',
                      'Vijay Deverakonda', 'Nani', 'Ravi Teja', 'Chiranjeevi', 'Balakrishna',
                      'Venkatesh', 'Nagarjuna', 'Rana Daggubati', 'Sai Dharam Tej', 'Sharwanand'],
        },
        heroines: {
            queries: ['Samantha Ruth Prabhu', 'Rashmika Mandanna', 'Pooja Hegde', 'Kajal Aggarwal',
                      'Anushka Shetty', 'Tamannaah Bhatia', 'Nayanthara', 'Shruti Haasan',
                      'Keerthy Suresh', 'Sai Pallavi', 'Rakul Preet Singh', 'Trisha Krishnan',
                      'Ritu Varma', 'Nabha Natesh', 'Krithi Shetty'],
        },
        directors: {
            queries: ['S. S. Rajamouli', 'Trivikram Srinivas', 'Sukumar', 'Koratala Siva',
                      'Boyapati Srinu', 'Harish Shankar', 'Vamshi Paidipally', 'Anil Ravipudi',
                      'Sandeep Reddy Vanga', 'Prashanth Neel', 'Nag Ashwin', 'Chandoo Mondeti',
                      'Maruthi', 'Teja', 'Puri Jagannadh'],
        },
        singers: {
            queries: ['S. P. Balasubrahmanyam', 'Sid Sriram', 'Anurag Kulkarni', 'Armaan Malik',
                      'Shreya Ghoshal', 'Sunitha Upadrashta', 'Karthik', 'Haricharan',
                      'Rahul Sipligunj', 'Geetha Madhuri', 'Kaala Bhairava', 'Hemachandra',
                      'Pranavi Athreyaa', 'Ramya Behara', 'Yazin Nizar'],
        },
    };

    const _cache = {};

    function buildCard(person) {
        const img  = person.profile_path
            ? `https://image.tmdb.org/t/p/w185${person.profile_path}`
            : PLACEHOLDER;
        const name = person.name || 'Unknown';
        const dept = person.known_for_department || '';
        const known = (person.known_for || []).slice(0, 1).map(k => k.title || k.name || '').filter(Boolean).join('');

        const card = document.createElement('div');
        card.className = 'celeb-card';
        card.innerHTML = `
            <div class="celeb-avatar-wrap">
                <img class="celeb-avatar" src="${img}" alt="${name}"
                     loading="lazy" onerror="this.src='${PLACEHOLDER}'">
            </div>
            <div class="celeb-name">${name}</div>
            <div class="celeb-dept">${known || dept}</div>`;
        card.addEventListener('click', () => {
            if (person.id) window.location.href = `/person/${person.id}`;
        });
        return card;
    }

    async function loadSection(sectionId) {
        if (_cache[sectionId]) return;

        const grid    = document.getElementById(`grid-${sectionId}`);
        const queries = SECTIONS[sectionId]?.queries || [];
        if (!grid || !queries.length) return;

        const results = await Promise.all(
            queries.map(q =>
                fetch(`/api/person/search?q=${encodeURIComponent(q)}`)
                    .then(r => r.json())
                    .then(d => (d.ok && d.results?.length) ? d.results[0] : null)
                    .catch(() => null)
            )
        );

        grid.innerHTML = '';
        const valid = results.filter(Boolean);
        valid.forEach(p => grid.appendChild(buildCard(p)));
        if (!grid.children.length) {
            grid.innerHTML = '<p class="celeb-empty">No results found.</p>';
        } else {
            _cache[sectionId] = true; // mark loaded only on success
        }
    }

    // Tab switching
    // (removed — all sections visible at once)

    // Load all sections on boot
    ['heroes', 'heroines', 'directors', 'singers'].forEach(id => loadSection(id));
})();
