"""Fill the database with a demo catalog and an admin account.

    python seed.py          # add demo data if the catalog is empty
    python seed.py --reset  # wipe everything and re-seed

Movies are the Blender Foundation's open films (Creative Commons).
The series and anime below are ORIGINAL placeholder shows whose episodes reuse
those sample clips, so you can test the player. Replace them with your own
content through the admin API (see README).
"""
import os
import sys
from app import app
from extensions import db
from models import User, Profile, Title, Episode, Genre, Favorite, Progress
from routes.admin import slugify

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@vortex.local")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "change-me-before-deploy")

BASE = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample"
CLIPS = [
    (f"{BASE}/BigBuckBunny.mp4", 10),
    (f"{BASE}/ElephantsDream.mp4", 11),
    (f"{BASE}/Sintel.mp4", 15),
    (f"{BASE}/TearsOfSteel.mp4", 12),
]

MOVIES = [
    dict(title="Big Buck Bunny", year=2008, maturity="G", duration=10, popularity=70,
         genres=["Animation", "Comedy", "Family"], featured=True, video_url=f"{BASE}/BigBuckBunny.mp4",
         poster_url=f"{BASE}/images/BigBuckBunny.jpg", backdrop_url=f"{BASE}/images/BigBuckBunny.jpg",
         description="A giant rabbit with a heart bigger than himself is pushed too far by three bullying rodents. Payback is a carrot-shaped plan."),
    dict(title="Sintel", year=2010, maturity="PG-13", duration=15, popularity=95,
         genres=["Animation", "Fantasy", "Adventure"], featured=True, video_url=f"{BASE}/Sintel.mp4",
         poster_url=f"{BASE}/images/Sintel.jpg", backdrop_url=f"{BASE}/images/Sintel.jpg",
         description="A lone warrior searches a harsh world for the baby dragon she once befriended, and finds out what the search cost her."),
    dict(title="Tears of Steel", year=2012, maturity="PG-13", duration=12, popularity=85,
         genres=["Sci-Fi", "Action", "Drama"], featured=True, video_url=f"{BASE}/TearsOfSteel.mp4",
         poster_url=f"{BASE}/images/TearsOfSteel.jpg", backdrop_url=f"{BASE}/images/TearsOfSteel.jpg",
         description="In a future Amsterdam, a group of warriors and scientists tries to save the world from destructive robots."),
    dict(title="Elephants Dream", year=2006, maturity="PG", duration=11, popularity=60,
         genres=["Animation", "Sci-Fi", "Fantasy"], video_url=f"{BASE}/ElephantsDream.mp4",
         poster_url=f"{BASE}/images/ElephantsDream.jpg", backdrop_url=f"{BASE}/images/ElephantsDream.jpg",
         description="Two strange characters explore a capricious and seemingly infinite machine. One of them is not sure it's real."),
]

# (title, type, year, maturity, genres, popularity, description, seasons: [episode names...])
SHOWS = [
    ("Dark Orbit", "series", 2024, "TV-14", ["Sci-Fi", "Thriller", "Drama"], 98, True,
     "When a research station stops answering from low orbit, a rescue pilot finds the crew alive and nobody willing to explain what they saw.",
     [["Silent Channel", "Docking", "The Fourth Window", "Cold Open"], ["Re-entry", "Ghost Telemetry", "Spin", "Apogee"]]),
    ("The Last Signal", "series", 2023, "TV-14", ["Mystery", "Thriller", "Drama"], 88, True,
     "A radio technician in a remote mountain town picks up a broadcast that describes tomorrow's news, one hour at a time.",
     [["Static", "Hour Zero", "Repeaters", "Dead Air", "Frequency", "Sign-off"]]),
    ("Harbor Lights", "series", 2022, "TV-PG", ["Drama", "Comedy"], 72, False,
     "Three generations of a family run the only ferry service on a stormy northern coast, and one tiny café that keeps it all afloat.",
     [["Low Tide", "Night Crossing", "Regulars", "The Inspector", "Lighthouse"]]),
    ("Iron Meridian", "series", 2025, "TV-MA", ["Action", "Crime", "Thriller"], 80, False,
     "A retired courier is dragged back into the city's underground rail network, where every delivery has a price.",
     [["Platform Nine", "Signal Failure", "Third Rail", "Last Train"]]),
    ("Neon Drift", "anime", 2024, "TV-14", ["Action", "Sci-Fi", "Cyberpunk"], 99, True,
     "In a rain-soaked megacity, a street racer with a stolen neural link discovers the circuit she drives on was built to hide something.",
     [["Ignition", "Ghost Lane", "Overclock", "Black Ice", "Redline", "Vanishing Point"], ["Cold Boot", "Static Bloom", "Terminal Velocity", "Afterglow"]]),
    ("Skyblade Academy", "anime", 2023, "TV-PG", ["Fantasy", "Action", "School"], 91, True,
     "Only the ones who can ride the wind are admitted to Skyblade. Rin can't even stand on a board, but the wind keeps choosing her.",
     [["The Wind Test", "Stormcallers", "Rival Squadron", "Cloudbreak", "The Long Dive", "Graduation Day"]]),
    ("Ashen Kingdom", "anime", 2022, "TV-MA", ["Fantasy", "Action", "Drama"], 84, False,
     "After the royal line burned, a masked knight and a runaway prince cross the ash plains in search of the last living flame.",
     [["Embers", "The Hollow Road", "Crown of Salt", "Pyre", "Sunrise Pact"]]),
    ("Moonvale Spirits", "anime", 2021, "TV-Y7", ["Family", "Fantasy", "Comedy"], 68, False,
     "Every night the tiny spirits of Moonvale swap places with the village's cats. Mio is the only one who has noticed.",
     [["Midnight Swap", "The Lantern Fish", "Mochi Thief", "Cat Council", "Moon Festival"]]),
    ("Kuro Circuit", "anime", 2025, "TV-14", ["Cyberpunk", "Mystery", "Sci-Fi"], 76, False,
     "A hacker for hire learns her client list is a list of people who were never born.",
     [["Null Entry", "Backdoor", "Mirror Port", "Kernel Panic"]]),
]


def get_genre(name):
    g = Genre.query.filter_by(slug=slugify(name)).first()
    if not g:
        g = Genre(name=name, slug=slugify(name))
        db.session.add(g)
    return g


def seed(reset=False):
    with app.app_context():
        if reset:
            for m in (Progress, Favorite, Episode):
                m.query.delete()
            db.session.execute(db.text("DELETE FROM title_genres"))
            for m in (Title, Genre, Profile, User):
                m.query.delete()
            db.session.commit()

        admin = User.query.filter_by(email=ADMIN_EMAIL).first()
        if not admin:
            admin = User(email=ADMIN_EMAIL, is_admin=True)
            db.session.add(admin)
        admin.is_admin = True
        admin.set_password(ADMIN_PASSWORD)
        if not admin.profiles:
            admin.profiles.append(Profile(name="Admin"))

        if Title.query.count():
            db.session.commit()
            print("Catalog already has titles. Admin credentials synced; use --reset to replace the catalog.")
            return

        for m in MOVIES:
            m = dict(m)
            genres = m.pop("genres")
            t = Title(type="movie", **m)
            t.genres = [get_genre(g) for g in genres]
            db.session.add(t)

        for i, (name, type_, year, mat, genres, pop, feat, desc, seasons) in enumerate(SHOWS):
            t = Title(type=type_, title=name, year=year, maturity=mat, popularity=pop,
                      featured=feat, description=desc)
            t.genres = [get_genre(g) for g in genres]
            n = 0
            for s, names in enumerate(seasons, start=1):
                for e, ep_name in enumerate(names, start=1):
                    url, mins = CLIPS[(i + n) % len(CLIPS)]
                    n += 1
                    t.episodes.append(Episode(
                        season=s, number=e, name=ep_name, duration=mins, video_url=url,
                        description=f"{name}, season {s}, episode {e}. Placeholder episode using a sample clip."))
            db.session.add(t)

        db.session.commit()
        print(f"Seeded {Title.query.count()} titles, {Episode.query.count()} episodes.")
        print(f"Admin login: {ADMIN_EMAIL} / {ADMIN_PASSWORD}  (change this before deploying!)")


if __name__ == "__main__":
    seed(reset="--reset" in sys.argv)
