const jwt = require('jsonwebtoken');
const values = require('./values');

module.exports = {
    isRoleValid: (role) => {
        return !isNaN(role) && role >= 0 && role <= 2;
    },
    isValidPhoneNumber: (phone) => {
        let success = false;
        let error = '';

        if (phone == '') error = 'Phone Number cannot be blank';
        else if (isNaN(phone) || phone.length != 10) error = 'Invalid Phone Number';
        else success = true;

        return { success, error };
    },
    isValidUsername: (username) => {
        let success = false;
        let error = '';

        if (username == '') error = 'Username cannot be blank';
        else if (username.length > 20) error = 'Invalid Username';
        else if (!username.match(/^[a-zA-Z0-9\-\s]+$/)) error = 'Usernames can only contain letters and numbers';
        else success = true;

        return { success, error };
    },
    isValidPassword: (password) => {
        let success = false;
        let error = '';

        if (password == '') error = 'Password cannot be blank';
        else if (password.length < 6 || password.length > 16) error = 'Passwords must be 6-16 characters long';
        else success = true;

        return { success, error };
    },
    getToken: (data) => {
        return 'JWT ' + jwt.sign({ data }, values.secret, { expiresIn: '70d' });
    },
    getPercentAmount: (total, percentage) => {
        return Math.round(total * percentage / 100);
    },
    getRandomNumber: (min, max) => {
        return Math.floor(Math.random() * (max - min + 1) + min);
    },
    getRandomBool: () => {
        return Math.random() >= 0.5;
    },
    getCurrentTime: () => {
        const d = new Date();
        return '' + d.getTime();
    },
    getS: (str) => {
        const d = new Date();
        return d.getTime() + str;
    },
    shuffledColors: () => {
        let array = [0, 1, 2, 3];

        for (var i = array.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = array[i];
            array[i] = array[j];
            array[j] = temp;
        }

        return array;
    },
    isArray: (o) => {
        return Object.prototype.toString.call(o) === '[object Array]'; 
    },
    stringSuccessor: (str) => {
      var alphabet = 'abcdefghijklmnopqrstuvwxyz',
            length = alphabet.length,
            result = str,
            i = str.length;

        while(i >= 0) {
            var last = str.charAt(--i),
                next = '',
                carry = false;

            if (isNaN(last)) {
                index = alphabet.indexOf(last.toLowerCase());

                if (index === -1) {
                    next = last;
                    carry = true;
                }
                else {
                    var isUpperCase = last === last.toUpperCase();
                    next = alphabet.charAt((index + 1) % length);
                    if (isUpperCase) {
                        next = next.toUpperCase();
                    }

                    carry = index + 1 >= length;
                    if (carry && i === 0) {
                        var added = isUpperCase ? 'A' : 'a';
                        result = added + next + result.slice(1);
                        break;
                    }
                }
            }
            else {
                next = +last + 1;
                if(next > 9) {
                    next = 0;
                    carry = true;
                }

                if (carry && i === 0) {
                    result = '1' + next + result.slice(1);
                    break;
                }
            }

            result = result.slice(0, i) + next + result.slice(i + 1);
            if (!carry) {
                break;
            }
        }
        
        return result;
    }
};