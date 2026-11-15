// Inspect hooks for temple-duties (docs/decisions/source-gaps-staged.md): the salter on the ramp, the Friday wipers, the
// kohen of the kanim and the caller before the afternoon tamid.
import { describeWith } from './index.js';

export const duties = describeWith({
  id: 'temple-duties',
  pools: {
    salter: {
      phrase: 'a kohen strewing salt on the ramp (who did it is not recorded)',
      doing: { 'ramp-salt': 'Casting salt over the ramp so the kohanim going up with the wood do not slip — even on Shabbat (Rambam TuM 6:3; Eruvin 10:14)' },
    },
    wipers: {
      phrase: 'a kohen wiping the altar with a cloth (how many did it is not recorded)',
      doing: { 'altar-wiping': 'Erev Shabbat: wiping the altar\'s stones with a cloth because of the blood (Middot 3:4, Rabbi), where the blood of the olot is thrown and poured' },
    },
    'kanim-kohen': {
      phrase: 'the kohen of the kanim, the golden reeds between the showbread loaves',
      doing: {
        'kanim-out': 'Erev Shabbat: drawing the kanim out from between the loaves and laying them along the table — neither setting nor removing them overrides Shabbat (Menachot 11:6)',
        'kanim-in': 'Sunday: putting the kanim back between the loaves (Rambam TuM 5:11)',
      },
    },
    caller: {
      phrase: 'one of the men of the officer over the times — not named (the Mishnah names Gevini the crier among the officers)',
      doing: { 'afternoon-call': '"Arise, kohanim, to the service; Levites, to the platform; Israel, to the ma\'amad!" — the time of the afternoon offering (Rambam KhM 7:2)' },
    },
  },
});
