import { rejectContactDetails } from "#policy/contact-details";

describe("the contact-detail rejector", () => {
  // DD3's own list, plus the shapes a person types when the first form is
  // refused. Every one names the fragment, because that is NFR12's first half.
  describe("refuses a phone number and names it", () => {
    it.each([
      ["+57 300 123 4567", "+57 300 123 4567"],
      ["3001234567", "3001234567"],
      ["300-123-4567", "300-123-4567"],
      ["300 123 45 67", "300 123 45 67"],
      ["(300) 123 4567", "(300) 123 4567"],
      ["300.123.4567", "300.123.4567"],
      ["57 300 123 4567", "57 300 123 4567"],
      ["+34 612 34 56 78", "+34 612 34 56 78"],
    ])("in %o", (form, fragment) => {
      const verdict = rejectContactDetails(`Cocino almuerzos, escríbeme al ${form} y hablamos.`);

      expect(verdict).toEqual({ ok: false, kind: "phone", fragment });
    });
  });

  describe("refuses an email address and names it", () => {
    it.each(["ana@example.co", "ANA.MARIA@correo.example.com.co", "ana+trabajo@example.co"])(
      "in %o",
      (address) => {
        const verdict = rejectContactDetails(`Mi correo es ${address} por si quieres escribir`);

        expect(verdict).toEqual({ ok: false, kind: "email", fragment: address });
      },
    );
  });

  describe("refuses a messaging or shortened link and names it", () => {
    it.each([
      "wa.me/573001234567",
      "https://wa.me/573001234567",
      "t.me/anamaria",
      "bit.ly/3xYz",
      "https://chat.whatsapp.com/AbCdEf",
      "WA.ME/573001234567",
    ])("in %o", (link) => {
      const verdict = rejectContactDetails(`Hablemos por ${link} cuando quieras`);

      expect(verdict).toEqual({ ok: false, kind: "messaging_url", fragment: link });
    });
  });

  describe("does not reject ordinary Spanish", () => {
    // Each of these has digits or an `@`-adjacent shape that a careless rule
    // would refuse, and refusing one breaks the publishing form for everyone.
    it.each([
      "Llámame el 15 a las 3",
      "Cocino para eventos de hasta 40 personas",
      "Cobro $50.000 el día, con almuerzo incluido",
      "Trabajé 12 años en una panadería de Pereira",
      "Vivo en la calle 14 # 23-45, barrio Cuba",
      "Desde el 10 de agosto de 2026 estoy buscando trabajo",
      "Tengo carro modelo 2015 y licencia de conducción",
      "Hago domicilios de 8 a. m. a 6 p. m.",
      "Cuido niños de 2 a 10 años",
      "1234 5678",
      "",
    ])("%o", (text) => {
      expect(rejectContactDetails(text)).toEqual({ ok: true });
    });
  });

  it("names the first thing it found when a text carries more than one", () => {
    const verdict = rejectContactDetails("ana@example.co o al 300 123 4567");

    expect(verdict).toEqual({ ok: false, kind: "email", fragment: "ana@example.co" });
  });
});
