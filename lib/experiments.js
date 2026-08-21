import experiments from "data/lab.json";

export function getExperiments() {
  return [...experiments].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getLatestExperiment() {
  return getExperiments()[0];
}

// Lab girdileri tarihli kayitlar; nokta ile yazilmis tarih defter fisi gibi
// duruyor ve mono yuzle hizalandiginda siralamayi tek bakista veriyor.
export function stampDate(iso) {
  return iso ? iso.replaceAll("-", ".") : "";
}
