(() => {
    const PLACEHOLDER = '/static/images/placeholder.svg';

    const LANG_LABELS = { te:'Telugu', hi:'Hindi', en:'English', ta:'Tamil', ml:'Malayalam', kn:'Kannada', bn:'Bengali', mr:'Marathi' };

    // Curated celebrity lists per language
    const LANG_CELEBS = {
        te: {
            heroes:    ['Prabhas','Mahesh Babu','Allu Arjun','Jr NTR','Ram Charan','Vijay Deverakonda','Nani','Ravi Teja','Chiranjeevi','Balakrishna','Venkatesh','Nagarjuna','Rana Daggubati','Sai Dharam Tej','Sharwanand'],
            heroines:  ['Samantha Ruth Prabhu','Rashmika Mandanna','Pooja Hegde','Kajal Aggarwal','Anushka Shetty','Tamannaah Bhatia','Nayanthara','Shruti Haasan','Keerthy Suresh','Sai Pallavi','Rakul Preet Singh','Trisha Krishnan','Ritu Varma','Nabha Natesh','Krithi Shetty'],
            directors: ['S. S. Rajamouli','Trivikram Srinivas','Sukumar','Koratala Siva','Boyapati Srinu','Harish Shankar','Vamshi Paidipally','Anil Ravipudi','Sandeep Reddy Vanga','Prashanth Neel','Nag Ashwin','Chandoo Mondeti','Maruthi','Teja','Puri Jagannadh'],
            singers:   ['S. P. Balasubrahmanyam','Sid Sriram','Anurag Kulkarni','Armaan Malik','Shreya Ghoshal','Sunitha Upadrashta','Karthik','Haricharan','Rahul Sipligunj','Geetha Madhuri','Kaala Bhairava','Hemachandra','Pranavi Athreyaa','Ramya Behara','Yazin Nizar'],
        },
        hi: {
            heroes:    ['Shah Rukh Khan','Salman Khan','Aamir Khan','Hrithik Roshan','Ranbir Kapoor','Ranveer Singh','Akshay Kumar','Varun Dhawan','Tiger Shroff','Ayushmann Khurrana','Vicky Kaushal','Kartik Aaryan','Shahid Kapoor','Pankaj Tripathi','Nawazuddin Siddiqui'],
            heroines:  ['Deepika Padukone','Alia Bhatt','Priyanka Chopra','Katrina Kaif','Kareena Kapoor','Anushka Sharma','Kangana Ranaut','Vidya Balan','Taapsee Pannu','Kriti Sanon','Sara Ali Khan','Janhvi Kapoor','Shraddha Kapoor','Kiara Advani','Disha Patani'],
            directors: ['Sanjay Leela Bhansali','Rajkumar Hirani','Zoya Akhtar','Anurag Kashyap','Kabir Khan','Rohit Shetty','Karan Johar','Imtiaz Ali','Vishal Bhardwaj','Shoojit Sircar','Nitesh Tiwari','Aanand L Rai','Sriram Raghavan','Vikramaditya Motwane','Luv Ranjan'],
            singers:   ['Arijit Singh','Sonu Nigam','Kumar Sanu','Udit Narayan','Shreya Ghoshal','Lata Mangeshkar','Asha Bhosle','Neha Kakkar','Armaan Malik','Jubin Nautiyal','Darshan Raval','Atif Aslam','Sunidhi Chauhan','Shaan','KK'],
        },
        ta: {
            heroes:    ['Rajinikanth','Kamal Haasan','Vijay','Ajith Kumar','Suriya','Vikram','Dhanush','Sivakarthikeyan','Vijay Sethupathi','Karthi','Jayam Ravi','Vishal','Arya','STR','Jiiva'],
            heroines:  ['Nayanthara','Trisha Krishnan','Samantha Ruth Prabhu','Tamannaah Bhatia','Keerthy Suresh','Sai Pallavi','Jyotika','Aishwarya Rajesh','Hansika Motwani','Shruti Haasan','Kajal Aggarwal','Anushka Shetty','Radhika Apte','Aditi Rao Hydari','Pooja Hegde'],
            directors: ['Mani Ratnam','Shankar','Lokesh Kanagaraj','Pa. Ranjith','Vetrimaaran','Atlee','AR Murugadoss','Selvaraghavan','Bala','Vijay Milton','Karthik Subbaraj','Nelson Dilipkumar','Siva','Linguswamy','Rajesh M'],
            singers:   ['AR Rahman','SPB','Hariharan','Unni Krishnan','Sid Sriram','Anirudh Ravichander','Yuvan Shankar Raja','Haricharan','Karthik','Benny Dayal','Vijay Prakash','Chinmayi','Shreya Ghoshal','Nithyasree Mahadevan','Bombay Jayashri'],
        },
        ml: {
            heroes:    ['Mohanlal','Mammootty','Dulquer Salmaan','Fahadh Faasil','Prithviraj Sukumaran','Nivin Pauly','Tovino Thomas','Jayasurya','Asif Ali','Unni Mukundan','Shane Nigam','Roshan Mathew','Soubin Shahir','Biju Menon','Indrajith Sukumaran'],
            heroines:  ['Manju Warrier','Shobana','Revathy','Parvathy Thiruvothu','Nazriya Nazim','Nithya Menen','Aishwarya Lekshmi','Anna Ben','Aparna Balamurali','Nimisha Sajayan','Keerthy Suresh','Samyuktha Menon','Malavika Mohanan','Rima Kallingal','Meera Jasmine'],
            directors: ['Priyadarshan','Lal Jose','Jeethu Joseph','Dileesh Pothan','Lijo Jose Pellissery','Aashiq Abu','Rajeev Ravi','Shyamaprasad','Vineeth Sreenivasan','Alphonse Puthren','Martin Prakkat','Midhun Manuel Thomas','Anjali Menon','Sidharth Siva','Sachy'],
            singers:   ['KJ Yesudas','MG Sreekumar','Sujatha Mohan','Shreya Ghoshal','Vijay Yesudas','Haricharan','Unni Menon','Rimi Tomy','Swetha Mohan','Najim Arshad','Vineeth Sreenivasan','Sid Sriram','Kester','Benny Dayal','Shankar Mahadevan'],
        },
        kn: {
            heroes:    ['Darshan','Sudeep','Yash','Puneeth Rajkumar','Shiva Rajkumar','Upendra','Ganesh','Rakshit Shetty','Rishab Shetty','Dhananjay','Srimurali','Duniya Vijay','Challenging Star Darshan','Prajwal Devaraj','Chiranjeevi Sarja'],
            heroines:  ['Ramya','Rachita Ram','Deepa Sannidhi','Srinidhi Shetty','Ragini Dwivedi','Aindrita Ray','Haripriya','Amulya','Nidhi Subbaiah','Aditi Prabhudeva','Rukmini Vasanth','Shalini Pandey','Nabha Natesh','Manvitha Harish','Bhavana'],
            directors: ['Pawan Kumar','Rishab Shetty','Raj B Shetty','Hemanth Rao','Narthan','Suri','Yogaraj Bhat','Gurudath','Shashank','Mansore','Girish Kasaravalli','P Sheshadri','Tharun Kishore Sudhir','Prashant Neel','Chethan Kumar'],
            singers:   ['SP Balasubrahmanyam','Rajesh Krishnan','Sonu Nigam','Shreya Ghoshal','Armaan Malik','Vijay Prakash','Anuradha Bhat','Tippu','Ranjith','Vasuki Vaibhav','Hamsalekha','Mano','Udit Narayan','Karthik','Haricharan'],
        },
        en: {
            heroes:    ['Tom Hanks','Leonardo DiCaprio','Brad Pitt','Robert Downey Jr','Chris Evans','Dwayne Johnson','Ryan Reynolds','Tom Cruise','Will Smith','Denzel Washington','Morgan Freeman','Johnny Depp','Matt Damon','Christian Bale','Hugh Jackman'],
            heroines:  ['Meryl Streep','Cate Blanchett','Natalie Portman','Scarlett Johansson','Jennifer Lawrence','Emma Stone','Angelina Jolie','Julia Roberts','Anne Hathaway','Charlize Theron','Sandra Bullock','Viola Davis','Amy Adams','Jessica Chastain','Margot Robbie'],
            directors: ['Christopher Nolan','Steven Spielberg','Martin Scorsese','James Cameron','Ridley Scott','David Fincher','Denis Villeneuve','Quentin Tarantino','Peter Jackson','Wes Anderson','Guillermo del Toro','Darren Aronofsky','Paul Thomas Anderson','Coen Brothers','Zack Snyder'],
            singers:   ['Ed Sheeran','Adele','Taylor Swift','Beyonce','Bruno Mars','The Weeknd','Billie Eilish','Harry Styles','Dua Lipa','Ariana Grande','Justin Bieber','Rihanna','Lady Gaga','Coldplay','Eminem'],
        },
    };

    // Fallback to Telugu if lang not in map
    function getCelebs() {
        const lang = localStorage.getItem('cm-lang') || 'te';
        return LANG_CELEBS[lang] || LANG_CELEBS['te'];
    }

    function getLangLabel() {
        const lang = localStorage.getItem('cm-lang') || 'te';
        return LANG_LABELS[lang] || 'Telugu';
    }

    function updateHeadings() {
        const L = getLangLabel();
        const map = {
            'section-heroes':    [`🦸 Heroes`, `Most popular ${L} male actors`],
            'section-heroines':  [`💃 Heroines`, `Most popular ${L} female actors`],
            'section-directors': [`🎬 Directors`, `Visionary ${L} filmmakers`],
            'section-singers':   [`🎵 Singers`, `Iconic voices of ${L} cinema`],
        };
        Object.entries(map).forEach(([id, [title, sub]]) => {
            const sec = document.getElementById(id);
            if (!sec) return;
            const t = sec.querySelector('.celeb-section-title');
            const s = sec.querySelector('.celeb-section-sub');
            if (t) t.textContent = title;
            if (s) s.textContent = sub;
        });
        // Page hero
        const pageTitle = document.querySelector('.celeb-page-title');
        const pageSub   = document.querySelector('.celeb-page-subtitle');
        if (pageTitle) pageTitle.innerHTML = `<span>🎭</span> ${L} Celebrities`;
        if (pageSub)   pageSub.textContent = `Heroes, Heroines, Directors, Singers & more`;
    }

    function buildCard(person) {
        const img  = person.profile_path
            ? `https://image.tmdb.org/t/p/w185${person.profile_path}`
            : PLACEHOLDER;
        const name  = person.name || 'Unknown';
        const dept  = person.known_for_department || '';
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

    function showSkeletons(grid) {
        grid.innerHTML = '';
        for (let i = 0; i < 12; i++) {
            const c = document.createElement('div');
            c.className = 'celeb-card celeb-skel';
            c.innerHTML = `<div class="celeb-avatar skeleton"></div>
                           <div class="celeb-skel-name skeleton"></div>
                           <div class="celeb-skel-sub skeleton"></div>`;
            grid.appendChild(c);
        }
    }

    async function loadSection(sectionId) {
        const grid    = document.getElementById(`grid-${sectionId}`);
        const queries = getCelebs()[sectionId] || [];
        if (!grid || !queries.length) return;

        showSkeletons(grid);

        const results = await Promise.all(
            queries.map(q =>
                fetch(`/api/person/search?q=${encodeURIComponent(q)}`)
                    .then(r => r.json())
                    .then(d => (d.ok && d.results?.length) ? d.results[0] : null)
                    .catch(() => null)
            )
        );

        grid.innerHTML = '';
        results.filter(Boolean).forEach(p => grid.appendChild(buildCard(p)));
        if (!grid.children.length) {
            grid.innerHTML = '<p class="celeb-empty">No results found.</p>';
        }
    }

    function bootAll() {
        updateHeadings();
        ['heroes', 'heroines', 'directors', 'singers'].forEach(id => loadSection(id));
    }

    bootAll();
})();
