import * as moment from "moment";
import { pick, filter } from "lodash";
import { default as download } from "downloadjs";

export const Utilities = {
  getToken() {
    if (this.localStorageEnabled()) {
      return window.localStorage.getItem("token");
    } else {
      return "";
    }
  },

  localStorageEnabled() {
    var test = "test";
    try {
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch(e) {
      return false;
    }
  },

  isLoggedIn() {
    const hasToken = this.getToken();
    return !!hasToken;
  },

  dateFormat(date, format, localize = true) {
    if (!localize) {
      return moment.utc(date).format(format);
    }
    return moment.utc(date).local().format(format);
  },

  dateFromNow(date) {
    return moment.utc(date).local().fromNow();
  },

  gqlUnauthorized(message) {
    return message === "GraphQL error: Unauthorized";
  },

  trimLeadingSlash(string) {
    if (string) {
      return `/${string.replace(/^\/+/g, "")}`;
    } else {
      return "";
    }
  },

  getNotificationType(item) {
    const keys = pick(item, ["email", "webhook", "pullRequest"]);
    const filteredKeys = filter(keys, (o) => o);
    if (filteredKeys[0] && filteredKeys[0].recipientAddress) {
      return "email";
    } else if (filteredKeys[0] && filteredKeys[0].uri) {
      return "webhook";
    } else {
      return "github";
    }
  },

  // Converts string to titlecase i.e. 'hello' -> 'Hello'
  // @returns {String}
  toTitleCase(word) {
    let i, j, str, lowers, uppers;
    const _word = typeof word === "string" ? word : this;
    str = _word.replace(/([^\W_]+[^\s-]*) */g, (txt) => {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });

    // Certain minor words should be left lowercase unless
    // they are the first or last words in the string
    lowers = ["A", "An", "The", "And", "But", "Or", "For", "Nor", "As", "At",
      "By", "For", "From", "In", "Into", "Near", "Of", "On", "Onto", "To", "With"];
    for (i = 0, j = lowers.length; i < j; i++) {
      str = str.replace(new RegExp("\\s" + lowers[i] + "\\s", "g"), (txt) => {
        return txt.toLowerCase();
      });
    }

    // Certain words such as initialisms or acronyms should be left uppercase
    uppers = ["Id", "Tv"];
    for (i = 0, j = uppers.length; i < j; i++) {
      str = str.replace(new RegExp("\\b" + uppers[i] + "\\b", "g"), uppers[i].toUpperCase());
    }

    return str;
  },

  logoutUser(client) {
    const token = this.getToken();
    // TODO: for now we just remove the token,
    // this DOES NOT perform an actual logout of GitHub.
    if (token) {
      if (client) {client.resetStore();}
      window.localStorage.removeItem("token");
      window.location = "/login";
    } else {
      window.location = "/login";
    }
  },

  isEmailValid(email) {
    const newEmail = email.trim();
    const exp = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return exp.test(newEmail);
  },

  async handleDownload(id) {
    const response = await fetch(`${window.env.SHIPDOWNLOAD_ENDPOINT}/${id}`, {
      headers: new Headers({
        "Authorization": Utilities.getToken(),
      }),
    })

    if (response.ok) {
      const blob = await response.blob();

      let contentType = response.headers.get("Content-Type");
      let filename = `rendered.${contentType}`;

      const contentDispositionHeader = response.headers.get("Content-Disposition");
      if (contentDispositionHeader) {
        ([, filename] = contentDispositionHeader.split("filename="));
      }

      download(blob, filename, response.headers.get("Content-Type"));
    }
  }
};