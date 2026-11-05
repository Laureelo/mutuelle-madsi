package com.madsi.backend.rapports;

import java.util.ArrayList;
import java.util.List;

/**
 * Contenu d'un rapport, indépendant du format de sortie : le même document sert pour le PDF, Excel et CSV.
 * Un rapport est une suite de sections ; chaque section a un titre, une note facultative, des lignes « libellé : valeur »
 * et un tableau facultatif. Les nombres (Number) sont alignés à droite et séparés par milliers ; les textes sont écrits tels quels.
 */
public class RapportDoc {

    public String organisation = "";
    public String titre = "";
    public String periode = "";
    public String genereLe = "";
    public String generePar = "";
    public final List<Section> sections = new ArrayList<>();

    public Section section(String titre) {
        Section s = new Section(titre);
        sections.add(s);
        return s;
    }

    public static class Section {
        public final String titre;
        public String note;
        public final List<String[]> infos = new ArrayList<>();
        public Tableau tableau;

        Section(String titre) {
            this.titre = titre;
        }

        public Section note(String n) {
            this.note = n;
            return this;
        }

        public Section info(String libelle, String valeur) {
            infos.add(new String[]{libelle, valeur});
            return this;
        }

        public Tableau tableau(String... entetes) {
            this.tableau = new Tableau(List.of(entetes));
            return this.tableau;
        }
    }

    public static class Tableau {
        public final List<String> entetes;
        public final List<List<Object>> lignes = new ArrayList<>();
        public List<Object> total;
        /** Texte affiché quand il n'y a aucune ligne. */
        public String vide = "Aucune donnée sur cette période.";

        Tableau(List<String> entetes) {
            this.entetes = entetes;
        }

        public Tableau ligne(Object... cellules) {
            lignes.add(new ArrayList<>(java.util.Arrays.asList(cellules)));
            return this;
        }

        public Tableau total(Object... cellules) {
            this.total = new ArrayList<>(java.util.Arrays.asList(cellules));
            return this;
        }

        public Tableau vide(String texte) {
            this.vide = texte;
            return this;
        }
    }
}
