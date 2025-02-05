const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
    author_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    commentDetails: {
        type: String,
        required: true
    },
}, {
    timestamps: true
});

const movieSchema = new mongoose.Schema({
    photo: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    genre: {
        type: String,
        enum: ["Action", "Comedy", "Sci-Fi", "Horror", "Documentary"],
        required: true
    },
    releasedDate: {
        type: Date,
        required: true
    },
    runtime: {
        type: Number
    },
    details: {
        type: String,
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    comments: [commentSchema]
});

const Movie = mongoose.model("Movie", movieSchema);

module.exports = Movie;