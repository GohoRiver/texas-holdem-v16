// 头像 + 名字池
window.PokerAvatars = (function(){
  const PROFILES = [
    { name:"Alex",  emoji:"🐯", bg:"linear-gradient(135deg,#fde68a,#f59e0b)" },
    { name:"Luna",  emoji:"🐺", bg:"linear-gradient(135deg,#cbd5e1,#475569)" },
    { name:"Kenji", emoji:"🦉", bg:"linear-gradient(135deg,#bae6fd,#0284c7)" },
    { name:"Bella", emoji:"🐼", bg:"linear-gradient(135deg,#f1f5f9,#94a3b8)" },
    { name:"Rex",   emoji:"🦁", bg:"linear-gradient(135deg,#fed7aa,#ea580c)" },
    { name:"Mira",  emoji:"🦊", bg:"linear-gradient(135deg,#fdba74,#c2410c)" },
    { name:"Otto",  emoji:"🐻", bg:"linear-gradient(135deg,#d6d3d1,#57534e)" },
    { name:"Zara",  emoji:"🐧", bg:"linear-gradient(135deg,#bfdbfe,#1d4ed8)" },
    { name:"Finn",  emoji:"🐨", bg:"linear-gradient(135deg,#e5e7eb,#6b7280)" },
    { name:"Ivy",   emoji:"🐸", bg:"linear-gradient(135deg,#bbf7d0,#15803d)" },
    { name:"Noah",  emoji:"🐵", bg:"linear-gradient(135deg,#fde68a,#b45309)" },
    { name:"Sage",  emoji:"🦅", bg:"linear-gradient(135deg,#ddd6fe,#6d28d9)" },
    { name:"Vega",  emoji:"🐙", bg:"linear-gradient(135deg,#fbcfe8,#be185d)" },
    { name:"Cato",  emoji:"🐱", bg:"linear-gradient(135deg,#fef3c7,#d97706)" },
    { name:"Nova",  emoji:"🦄", bg:"linear-gradient(135deg,#f9a8d4,#a21caf)" },
    { name:"Echo",  emoji:"🐳", bg:"linear-gradient(135deg,#a5f3fc,#0e7490)" },
    { name:"Kai",   emoji:"🦈", bg:"linear-gradient(135deg,#bae6fd,#0c4a6e)" },
    { name:"Iris",  emoji:"🦋", bg:"linear-gradient(135deg,#c4b5fd,#5b21b6)" }
  ];

  const HUMAN = {
    name: "你",
    emoji: "🦊",
    bg: "linear-gradient(135deg,#a5f3fc,#0891b2)"
  };

  function pickProfiles(n){
    const pool = PROFILES.slice();
    for(let i = pool.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    return pool.slice(0, n);
  }

  return { PROFILES: PROFILES, HUMAN: HUMAN, pickProfiles: pickProfiles };
})();