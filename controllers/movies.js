const express = require("express");
const router = express.Router();

const Movie = require("../models/movie");
const User = require("../models/user");
const cloudinary = require('cloudinary').v2;

const verifyToken = require("../middleware/verify-token");
const authenticateOptional = require("../middleware/authenticate-optional");

const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const s3client = new S3Client({
    region: "us-west-1"
});
const { v4: uuidv } = require("uuid");

const upload = require("../middleware/upload");

router.get("/", async (req, res) => {
    try {
        const movieDocs = await Movie
            .find({})
            .populate("user", "username")
            .sort({ _id: -1 });

        res.status(200).json(movieDocs);
    } catch (err) {
        res.status(500).json({ err: err.message });
    }
});

router.get("/my-movies", verifyToken, async (req, res) => {
    try {
        const userId = req.user._id.toString();

        const myMovies = await Movie.find({ user: userId }).sort({ _id: -1 });

        res.status(200).json(myMovies);
    } catch (error) {
        res.status(500).json({ err: err.message });
    }
});

// photo is the name of the form field that contains the uploaded file
router.post("/", verifyToken, upload.single("photo"), async (req, res) => {


    try {

        const userId = req.user._id.toString();

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ err: "User not found" });
        }

        if (req.file) {
            const uploadedResponse = await cloudinary.uploader.upload(req.file.path);
            photo = uploadedResponse.secure_url;
        }

        const newMovie = new Movie({
            ...req.body,
            user: userId,
            photo
        })

        await newMovie.save();

        res.status(201).json(newMovie);
    } catch (err) {
        console.log(err);
        res.status(500).json({ err: err.message });
    }


});

router.get("/:movieId", async (req, res) => {
    try {
        const selectedMovie = await Movie.findById(req.params.movieId).populate("user", "username").populate("comments.author_id", "username").lean();

        if (!selectedMovie) {
            return res.status(404).json({ err: "Movie not found" });
        }

        selectedMovie.comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

        res.status(200).json(selectedMovie);
    } catch (err) {
        res.status(500).json({ err: err.message });
    }
});

router.put("/:movieId", verifyToken, upload.single('photo'), async (req, res) => {
    try {
        const userMovieDoc = await Movie.findOne({ user: req.user._id, _id: req.params.movieId });

        if (!userMovieDoc) {

            return res.status(403).json({ message: "You are not allowed to update this movie." });
        }

        let photoUrl = userMovieDoc.photo;

        if (req.file) {
            const uploadedResponse = await cloudinary.uploader.upload(req.file.path);
            photoUrl = uploadedResponse.secure_url;
        }

        const updatedFields = {
            ...req.body,
            photo: photoUrl
        }

        const updatedMovie = await Movie.findByIdAndUpdate(req.params.movieId, updatedFields, { new: true }).populate("user", "username");;

        res.status(200).json(updatedMovie);

    } catch (err) {
        res.status(500).json({ err: err.message });
    }
});

router.delete("/:movieId", verifyToken, async (req, res) => {
    console.log(req.params.movieId)
    try {
        const userMovieDoc = await Movie.findById(req.params.movieId);

        if (!userMovieDoc.user.equals(req.user._id)) {
            return res.status(403).json({ message: "You are not allowed to delete this movie." });
        }

        const deletedUserMovie = await Movie.findByIdAndDelete(req.params.movieId);

        res.status(200).json({ message: "Movie was successfully deleted." });
    } catch (err) {
        res.status(500).json({ err: err.message })
    }
});

router.post("/:movieId/comments", verifyToken, async (req, res) => {
    try {
        const movieDoc = await Movie.findById(req.params.movieId);

        if (!movieDoc) {
            return res.status(404).json({ err: "Movie not found." });
        }

        const newComment = {
            author_id: req.user._id,
            commentDetails: req.body.commentDetails
        }

        // console.log(newComment)

        movieDoc.comments.push(newComment);

        await movieDoc.save();

        const updatedMovie = await Movie.findById(req.params.movieId)
            .populate("comments.author_id", "username")

        res.status(201).json(updatedMovie)
    } catch (err) {
        res.status(500).json({ err: err.message });
    }
});

router.get("/:movieId/comments/:commentId", verifyToken, async (req, res) => {
    try {
        const movieDoc = await Movie.findById(req.params.movieId);

        if (!movieDoc) {
            return res.status(404).json({ err: "Movie not found." });
        }

        const foundComment = movieDoc.comments.id(req.params.commentId);

        if (!foundComment) {
            return res.status(404).json({ err: "Comment not found." });
        }

        if (foundComment.author_id.toString() !== req.user._id) {
            return res.status(403).json({ message: "You are not authorized to edit this comment." });
        }

        res.status(200).json(foundComment);

    } catch (err) {
        res.status(500).json({ err: err.message });
    }
});

router.put("/:movieId/comments/:commentId", verifyToken, async (req, res) => {
    try {
        const movieDoc = await Movie.findById(req.params.movieId);

        if (!movieDoc) {
            return res.status(404).json({ err: "Movie not found." });
        }

        const foundComment = movieDoc.comments.id(req.params.commentId);

        if (!foundComment) {
            return res.status(404).json({ err: "Comment not found." });
        }

        if (foundComment.author_id.toString() !== req.user._id) {
            return res.status(403).json({ message: "You are not authorized to edit this comment." });
        }

        foundComment.commentDetails = req.body.commentDetails;

        await movieDoc.save();

        const updatedMovie = await Movie.findById(req.params.movieId);

        res.status(200).json(updatedMovie);
    } catch (err) {
        res.status(500).json({ err: err.message });
    }
});

router.delete("/:movieId/comments/:commentId", verifyToken, async (req, res) => {
    try {
        const movieDoc = await Movie.findById(req.params.movieId);

        if (!movieDoc) {
            return res.status(404).json({ err: "Movie not found." });
        }

        const commentToDelete = movieDoc.comments.id(req.params.commentId);

        if (!commentToDelete) {
            return res.status(404).json({ err: "Comment not found." });
        }

        if (commentToDelete.author_id.toString() !== req.user._id) {
            return res.status(403).json({ message: "You are not authorized to delete this comment." });
        }

        movieDoc.comments.pull(req.params.commentId);

        await movieDoc.save();

        res.status(200).json({ message: "Comment deleted successfully." });
    } catch (err) {
        res.status(500).json({ err: err.message });
    }
});

module.exports = router;