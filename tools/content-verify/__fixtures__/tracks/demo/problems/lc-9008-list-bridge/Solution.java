import java.util.*;

class Solution {
    public List<String> keepLonger(List<String> words, int minLength) {
        words.removeIf(word -> word.length() < minLength); // needs a mutable list
        return words;
    }
}
